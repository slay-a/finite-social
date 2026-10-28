// Parses an uploaded PDF into book_pages (chunked + resumable: the client
// re-invokes until done:true) and then builds the section tree (topic outline).
// Outline detection order: PDF bookmarks -> LLM over the ToC pages -> fixed
// page ranges as a last resort, so every book gets a usable tree.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getDocumentProxy, extractImages } from 'npm:unpdf@0.12.1';
import { encode as encodePng } from 'npm:fast-png@6.2.0';
import { verifyUser, json, corsHeaders } from '../_shared/userAuth.ts';
import { moderateText } from '../_shared/moderation.ts';

const PAGES_PER_INVOCATION = 50;
const MAX_FIGURES_PER_PAGE = 3;
const MAX_FIGURES_PER_BOOK = 60;
const MIN_FIGURE_PIXELS = 40_000;   // skip icons/logos (< ~200x200)
const MAX_FIGURE_PIXELS = 4_000_000; // skip giant scans (memory)
const SCANNED_PDF_MIN_CHARS = 100; // across the first chunk
const MAX_PAGE_CHARS = 8000;
const OUTLINE_MODEL = 'gpt-4o-mini';

interface SectionDraft {
  parentIdx: number | null;
  depth: number;
  order_index: number;
  label: string | null;
  title: string;
  page_start: number;
  page_end: number;
}

async function extractPageRange(
  pdf: any,
  start: number,
  endExclusive: number,
): Promise<Array<{ page_no: number; text: string }>> {
  const out: Array<{ page_no: number; text: string }> = [];
  for (let p = start; p < endExclusive; p++) {
    try {
      const page = await pdf.getPage(p + 1); // pdf.js pages are 1-based
      const content = await page.getTextContent();
      const text = content.items
        .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_PAGE_CHARS);
      out.push({ page_no: p, text });
      page.cleanup?.();
    } catch {
      out.push({ page_no: p, text: '' });
    }
  }
  return out;
}

// --- Figure extraction ------------------------------------------------------
// The author's own diagrams, pulled straight from the PDF and stored as PNGs.
// Best-effort: any failure skips the figure, never the parse.
async function extractPageFigures(
  sb: ReturnType<typeof createClient>,
  pdf: any,
  book: { id: string; owner_id: string },
  pageNo: number,
  figuresSoFar: number,
): Promise<number> {
  if (figuresSoFar >= MAX_FIGURES_PER_BOOK) return 0;
  let added = 0;
  try {
    const images = await extractImages(pdf, pageNo + 1); // 1-based pages
    for (let i = 0; i < Math.min(images?.length ?? 0, MAX_FIGURES_PER_PAGE); i++) {
      try {
        const img: any = images[i];
        const width = img?.width ?? 0;
        const height = img?.height ?? 0;
        const data = img?.data;
        const pixels = width * height;
        if (!data || pixels < MIN_FIGURE_PIXELS || pixels > MAX_FIGURE_PIXELS) continue;
        const channels = Math.round(data.length / pixels);
        if (![1, 3, 4].includes(channels)) continue;

        const png = encodePng({ width, height, data, channels: channels as 1 | 3 | 4 });
        const path = `${book.owner_id}/${book.id}/figures/p${pageNo}-${i}.png`;
        const { error: upError } = await sb.storage.from('books')
          .upload(path, png, { contentType: 'image/png', upsert: true });
        if (upError) continue;

        await sb.from('book_figures').upsert({
          book_id: book.id,
          owner_id: book.owner_id,
          page_no: pageNo,
          idx: i,
          storage_path: path,
          width,
          height,
        }, { onConflict: 'book_id,page_no,idx' });
        added++;
        if (figuresSoFar + added >= MAX_FIGURES_PER_BOOK) break;
      } catch { /* skip this image */ }
    }
  } catch { /* page has no extractable images */ }
  return added;
}

// --- Outline strategy 1: the PDF's own bookmarks --------------------------
async function outlineFromBookmarks(pdf: any, pageCount: number): Promise<SectionDraft[]> {
  const outline = await pdf.getOutline().catch(() => null);
  if (!outline || outline.length === 0) return [];

  const flat: Array<{ depth: number; title: string; pageIdx: number }> = [];

  async function resolvePage(item: any): Promise<number | null> {
    try {
      let dest = item.dest;
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (!Array.isArray(dest) || !dest[0]) return null;
      return await pdf.getPageIndex(dest[0]);
    } catch {
      return null;
    }
  }

  async function walk(items: any[], depth: number) {
    for (const item of items) {
      if (depth <= 1 && item.title) {
        const pageIdx = await resolvePage(item);
        if (pageIdx !== null) flat.push({ depth, title: String(item.title).trim(), pageIdx });
      }
      if (item.items?.length && depth < 1) await walk(item.items, depth + 1);
    }
  }
  await walk(outline, 0);

  if (flat.length < 2) return [];
  flat.sort((a, b) => a.pageIdx - b.pageIdx || a.depth - b.depth);

  const sections: SectionDraft[] = [];
  let lastTopIdx: number | null = null;
  flat.forEach((f, i) => {
    // End = next entry at the same-or-shallower depth, else end of book.
    let end = pageCount - 1;
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[j].depth <= f.depth) { end = Math.max(f.pageIdx, flat[j].pageIdx - 1); break; }
    }
    sections.push({
      parentIdx: f.depth === 0 ? null : lastTopIdx,
      depth: f.depth,
      order_index: i,
      label: null,
      title: f.title.slice(0, 200),
      page_start: f.pageIdx,
      page_end: end,
    });
    if (f.depth === 0) lastTopIdx = sections.length - 1;
  });
  return sections;
}

// --- Outline strategy 2: LLM over the front matter / ToC -------------------
async function outlineFromLlm(
  frontText: string,
  pageCount: number,
  apiKey: string,
): Promise<SectionDraft[]> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OUTLINE_MODEL,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: pageCount <= 40
            ? `You extract the structure of a short document (a paper, article, or booklet) from its full text. It has ${pageCount} pages (0-indexed; page markers like [page N] show where each page starts). Return JSON: {"sections":[{"label":"1","title":"...","page_start":N,"page_end":N,"depth":0}]}. Split it into its real logical sections in reading order (for a paper: Abstract, Introduction, each named section, Conclusion; merge tiny fragments into their neighbor). Use the actual section titles from the text. Number labels "1", "2", ... in order. NEVER create a section for references, bibliography, acknowledgments, or author biographies; fold a conclusion that shares a page with them into the preceding section instead. Non-overlapping 0-indexed page ranges. 2-10 sections.`
            : `You extract a book's structure from its front matter / table of contents. The book has ${pageCount} pages (0-indexed). Return JSON: {"sections":[{"label":"1" or "1.2" or null,"title":"...","page_start":N,"page_end":N,"depth":0 or 1}]}. Top-level chapters (depth 0) and optionally their sub-sections (depth 1), in reading order, with non-overlapping page ranges covering the body of the book. NEVER create a section for references, bibliography, acknowledgments, or an index. Page numbers printed in a ToC are usually offset from physical pages; estimate the physical (0-indexed) pages as best you can. 8-40 sections total.`,
        },
        { role: 'user', content: frontText.slice(0, 48000) },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
  const raw: any[] = Array.isArray(parsed?.sections) ? parsed.sections : [];

  const sections: SectionDraft[] = [];
  let lastTopIdx: number | null = null;
  raw.forEach((s, i) => {
    const start = Math.max(0, Math.min(pageCount - 1, Number(s.page_start) || 0));
    const end = Math.max(start, Math.min(pageCount - 1, Number(s.page_end) || start));
    const depth = s.depth === 1 ? 1 : 0;
    if (!s.title) return;
    // Defense in depth: bibliographies make useless study cards.
    if (/\b(references|bibliography|acknowledg|about the authors?|index)\b/i.test(String(s.title))) return;
    sections.push({
      parentIdx: depth === 0 ? null : lastTopIdx,
      depth,
      order_index: i,
      label: s.label ? String(s.label).slice(0, 20) : null,
      title: String(s.title).slice(0, 200),
      page_start: start,
      page_end: end,
    });
    if (depth === 0) lastTopIdx = sections.length - 1;
  });
  return sections.length >= 1 ? sections : [];
}

// --- Outline strategy 3: fixed-size parts (always works) -------------------
function outlineFallback(pageCount: number): SectionDraft[] {
  const chunk = Math.max(8, Math.ceil(pageCount / 20));
  const sections: SectionDraft[] = [];
  for (let start = 0, i = 0; start < pageCount; start += chunk, i++) {
    sections.push({
      parentIdx: null,
      depth: 0,
      order_index: i,
      label: `${i + 1}`,
      title: `Part ${i + 1}`,
      page_start: start,
      page_end: Math.min(start + chunk - 1, pageCount - 1),
    });
  }
  return sections;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await verifyUser(req);
  if (auth instanceof Response) return auth;

  const { book_id } = await req.json().catch(() => ({}));
  if (!book_id) return json({ error: 'book_id required' }, 400);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: book, error: bookError } = await sb
    .from('books').select('*').eq('id', book_id).single();
  if (bookError || !book) return json({ error: 'Book not found' }, 404);
  if (book.owner_id !== auth.userId) return json({ error: 'Not your book' }, 403);
  if (book.status === 'outlined') return json({ done: true, progress: book.page_count, total: book.page_count });

  try {
    const { data: file, error: dlError } = await sb.storage.from('books').download(book.file_path);
    if (dlError || !file) throw new Error(`download failed: ${dlError?.message}`);
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
    const pageCount: number = pdf.numPages;

    const start = book.parse_progress ?? 0;
    const end = Math.min(start + PAGES_PER_INVOCATION, pageCount);

    const pages = await extractPageRange(pdf, start, end);

    // Pull the author's own figures from this chunk's pages (best-effort).
    const { count: existingFigures } = await sb
      .from('book_figures').select('id', { count: 'exact', head: true }).eq('book_id', book.id);
    let figures = existingFigures ?? 0;
    for (let p = start; p < end && figures < MAX_FIGURES_PER_BOOK; p++) {
      figures += await extractPageFigures(sb, pdf, book, p, figures);
    }

    // Scanned-PDF gate on the first chunk: no text layer means no feature.
    if (start === 0) {
      const chars = pages.reduce((n, p) => n + p.text.length, 0);
      if (chars < SCANNED_PDF_MIN_CHARS) {
        await sb.from('books').update({
          status: 'failed',
          parse_error: 'This looks like a scanned PDF with no text layer. Scanned books are not supported yet.',
        }).eq('id', book.id);
        return json({ done: true, failed: true, error: 'scanned_pdf' });
      }

      // Content gate: sample the opening text before any cards can be made.
      const moderationKey = Deno.env.get('OPENAI_API_KEY');
      if (moderationKey) {
        const sample = pages.map((p) => p.text).join('\n').slice(0, 20_000);
        const verdict = await moderateText(sample, moderationKey);
        if (verdict.flagged) {
          await sb.from('books').update({
            status: 'failed',
            parse_error: 'This upload was rejected: the content violates our guidelines.',
          }).eq('id', book.id);
          await sb.storage.from('books').remove([book.file_path]).catch(() => {});
          return json({ done: true, failed: true, error: 'content_rejected' });
        }
      }
    }

    await sb.from('book_pages').upsert(
      pages.map((p) => ({ book_id: book.id, owner_id: book.owner_id, ...p })),
    );

    if (end < pageCount) {
      await sb.from('books').update({
        status: 'parsing', parse_progress: end, page_count: pageCount,
      }).eq('id', book.id);
      return json({ done: false, progress: end, total: pageCount });
    }

    // All pages stored — build the outline.
    let sections = await outlineFromBookmarks(pdf, pageCount);
    if (sections.length === 0) {
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (apiKey) {
        // Short documents (papers, articles): the LLM sees the whole text with
        // page markers and splits it into its real sections. Longer books: the
        // front matter / ToC region is enough.
        const query = sb.from('book_pages').select('page_no, text').eq('book_id', book.id).order('page_no');
        const { data: front } = pageCount <= 40 ? await query : await query.lte('page_no', 19);
        const frontText = (front ?? []).map((r) => `[page ${r.page_no}]\n${r.text}`).join('\n');
        sections = await outlineFromLlm(frontText, pageCount, apiKey).catch(() => []);
      }
    }
    if (sections.length === 0) sections = outlineFallback(pageCount);

    // Insert parents first so children can reference their ids.
    const idByIdx = new Map<number, string>();
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const { data: inserted, error: insError } = await sb.from('book_sections').insert({
        book_id: book.id,
        owner_id: book.owner_id,
        parent_id: s.parentIdx !== null ? idByIdx.get(s.parentIdx) ?? null : null,
        depth: s.depth,
        order_index: s.order_index,
        label: s.label,
        title: s.title,
        page_start: s.page_start,
        page_end: s.page_end,
      }).select('id').single();
      if (insError) throw new Error(`section insert: ${insError.message}`);
      idByIdx.set(i, inserted.id);
    }

    await sb.from('books').update({
      status: 'outlined', parse_progress: pageCount, page_count: pageCount, parse_error: null,
    }).eq('id', book.id);

    return json({ done: true, progress: pageCount, total: pageCount, sections: sections.length });
  } catch (e) {
    const message = String(e instanceof Error ? e.message : e).slice(0, 300);
    await sb.from('books').update({ status: 'failed', parse_error: message }).eq('id', book.id);
    return json({ done: true, failed: true, error: message });
  }
});
