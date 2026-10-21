// Parses an uploaded PDF into book_pages (chunked + resumable: the client
// re-invokes until done:true) and then builds the section tree (topic outline).
// Outline detection order: PDF bookmarks -> LLM over the ToC pages -> fixed
// page ranges as a last resort, so every book gets a usable tree.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { getDocumentProxy } from 'npm:unpdf@0.12.1';
import { verifyUser, json, corsHeaders } from '../_shared/userAuth.ts';

const PAGES_PER_INVOCATION = 50;
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
          content: `You extract a book's structure from its front matter / table of contents. The book has ${pageCount} pages (0-indexed). Return JSON: {"sections":[{"label":"1" or "1.2" or null,"title":"...","page_start":N,"page_end":N,"depth":0 or 1}]} — top-level chapters (depth 0) and optionally their sub-sections (depth 1), in reading order, with non-overlapping page ranges covering the body of the book. Page numbers printed in a ToC are usually offset from physical pages; estimate the physical (0-indexed) pages as best you can. 8-40 sections total.`,
        },
        { role: 'user', content: frontText.slice(0, 24000) },
      ],
      signal: undefined,
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
  return sections.length >= 2 ? sections : [];
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
      title: `Part ${i + 1} (pages ${start + 1}–${Math.min(start + chunk, pageCount)})`,
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
        const { data: front } = await sb
          .from('book_pages').select('text')
          .eq('book_id', book.id).lte('page_no', 19).order('page_no');
        const frontText = (front ?? []).map((r) => r.text).join('\n');
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
