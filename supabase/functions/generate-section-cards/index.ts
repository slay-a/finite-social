// Turns one book section's pages into a swipeable feed of study cards, on first
// visit, then cached forever in section_cards. Idempotent: a second call while
// generating (or after ready) just reports status; the client polls.
// Card kinds: content (text + optional visual), quiz (active recall), and
// figure (the book's own images, appended from book_figures, never generated).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyUser, json, corsHeaders } from '../_shared/userAuth.ts';

const MODEL = 'gpt-4o-mini';
const MAX_INPUT_CHARS_CONCISE = 12_000;
const MAX_INPUT_CHARS_DETAILED = 24_000;
const MAX_FIGURE_CARDS = 6;

const BASE_RULES = `Each content card: a punchy title (max 8 words) and a SCANNABLE body, max 90 words. This renders on a phone screen, so layout is everything:
- One idea per card. Split dense material across cards instead of packing one.
- Prefer a one-sentence lead line, then 2-4 short bullets. Every bullet starts with "- " at the START OF ITS OWN LINE (separate lines with \\n). NEVER run bullets inline after a colon.
- Paragraphs: max 2 sentences, separated by a blank line.
- **bold** only for key terms. No headings, no emoji, no "In this section". Never use em dashes or en dashes; use commas or periods. Write like an excellent teacher: concrete, direct, zero filler.

MATH: NEVER drop, paraphrase, or summarize away a formula; the formulas ARE the material. Every key formula gets its OWN LINE as display math: a line containing only $$...$$. Inline symbols go in $...$. Use minimal LaTeX: subscripts _{}, superscripts ^{}, Greek letters (\\alpha), \\ldots for dots, \\rightarrow for arrows. Keep fractions as a/b. Never use \\text{}; write plain words outside the math instead. Never write raw underscores or carets outside $...$.

SCOPE: the page text below may also contain material from NEIGHBORING sections (pages are shared). Cover ONLY the material that belongs to the named section; ignore the rest. Never make cards about the document's references, bibliography, or author biographies.

FIDELITY: a reader who finishes these cards should have effectively read the section, no more and no less. Every claim must come from the text; never pad with generic filler the text does not say (phrases like "further research is needed", "this is important to understand", "progress is expected"). Never repeat the same point across cards.

VISUALS: aim for 1-2 per section whenever the material contains a process, a set of named categories or types, a comparison, dated phases, or verbatim numbers; use plain text only when nothing fits. At most 3 per section, each type only where it fits:
- {"type":"flow","steps":["step 1","step 2","step 3"]} for a process or pipeline (3-5 short steps)
- {"type":"cycle","steps":["phase 1","phase 2","phase 3"]} for a repeating loop (3-5 phases)
- {"type":"compare","left":{"label":"...","points":["..."]},"right":{"label":"...","points":["..."]}} for contrasting two things (2-3 points each)
- {"type":"grid","items":[{"label":"...","text":"..."}]} for 3-6 named categories or types
- {"type":"timeline","items":[{"label":"1998","text":"..."}]} ONLY when the text itself gives dates or ordered phases (3-6 entries)
- {"type":"stats","items":[{"value":"95%","label":"accuracy"}]} ONLY for figures stated verbatim in the text (2-4 tiles)
Never invent numbers, dates, or categories that are not in the text.

QUIZ: also include quiz cards for active recall, one per 3-4 content cards, placed after the material they test. A quiz card is {"kind":"quiz","question":"...","options":["...","...","..."],"answer":0,"why":"one sentence"}. 3-4 options, exactly one correct, the answer index 0-based, distractors plausible but clearly wrong per the text.

Reply ONLY with JSON: {"cards":[{"kind":"content","title":"...","body":"...","visual":{...} or omit} | {"kind":"quiz",...}]}`;

const CONCISE_PROMPT = `You turn a textbook section into a short swipeable feed of study cards for a mobile app. Produce 3-6 content cards that teach the material in a sensible order: the core idea in plain language, then the key points or mechanism, then a concrete example, and a quick recap or common pitfall if the material warrants it. Add 1-2 quiz cards.

${BASE_RULES}`;

const DETAILED_PROMPT = `You turn a textbook section into a swipeable feed of study cards for a mobile app. Cover EVERYTHING of substance in the text, in reading order: every concept, definition, mechanism, example, formula, and caveat gets represented. Produce as many content cards as the material needs (typically 6-14), plus quiz cards per the rules. Do not skip content to save space; split dense material across multiple cards instead.

${BASE_RULES}`;

interface RawCard {
  kind?: string;
  title?: string;
  body?: string;
  visual?: any;
  question?: string;
  options?: unknown;
  answer?: unknown;
  why?: string;
}

function cleanDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ', ').replace(/, ,/g, ',');
}

function strList(x: unknown, max: number): string[] {
  return Array.isArray(x) ? x.filter((s) => typeof s === 'string' && s.trim()).slice(0, max) : [];
}

function validVisual(v: any): object | null {
  if (!v || typeof v !== 'object') return null;
  if ((v.type === 'flow' || v.type === 'cycle')) {
    const steps = strList(v.steps, 6);
    return steps.length >= 2 ? { type: v.type, steps } : null;
  }
  if (v.type === 'compare') {
    const side = (x: any) =>
      x && typeof x.label === 'string' && strList(x.points, 4).length
        ? { label: x.label.slice(0, 40), points: strList(x.points, 4) }
        : null;
    const left = side(v.left);
    const right = side(v.right);
    return left && right ? { type: 'compare', left, right } : null;
  }
  if (v.type === 'grid' || v.type === 'timeline') {
    const items = (Array.isArray(v.items) ? v.items : [])
      .filter((it: any) => typeof it?.label === 'string' && typeof it?.text === 'string')
      .map((it: any) => ({ label: it.label.slice(0, 40), text: it.text.slice(0, 160) }))
      .slice(0, 6);
    return items.length >= 2 ? { type: v.type, items } : null;
  }
  if (v.type === 'stats') {
    const items = (Array.isArray(v.items) ? v.items : [])
      .filter((it: any) => typeof it?.value === 'string' && typeof it?.label === 'string')
      .map((it: any) => ({ value: it.value.slice(0, 16), label: it.label.slice(0, 50) }))
      .slice(0, 4);
    return items.length >= 2 ? { type: 'stats', items } : null;
  }
  return null;
}

function validQuiz(c: RawCard): object | null {
  const options = strList(c.options, 4);
  const answer = Number(c.answer);
  if (!c.question?.trim() || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
    return null;
  }
  return {
    question: cleanDashes(c.question.trim()).slice(0, 300),
    options: options.map((o) => cleanDashes(o).slice(0, 160)),
    answer,
    why: c.why ? cleanDashes(String(c.why)).slice(0, 300) : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await verifyUser(req);
  if (auth instanceof Response) return auth;

  const { section_id } = await req.json().catch(() => ({}));
  if (!section_id) return json({ error: 'section_id required' }, 400);

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'OPENAI_API_KEY not configured' }, 500);

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: section, error: secError } = await sb
    .from('book_sections').select('*').eq('id', section_id).single();
  if (secError || !section) return json({ error: 'Section not found' }, 404);
  if (section.owner_id !== auth.userId) return json({ error: 'Not your section' }, 403);

  if (section.card_status === 'ready') return json({ status: 'ready' });

  const { data: claimed } = await sb
    .from('book_sections')
    .update({ card_status: 'generating' })
    .eq('id', section_id)
    .in('card_status', ['none', 'failed'])
    .select('id');
  if (!claimed || claimed.length === 0) return json({ status: 'generating' });

  try {
    const { data: book } = await sb
      .from('books').select('card_mode').eq('id', section.book_id).single();
    const detailed = book?.card_mode === 'detailed';

    const { data: pages, error: pagesError } = await sb
      .from('book_pages')
      .select('text')
      .eq('book_id', section.book_id)
      .gte('page_no', section.page_start)
      .lte('page_no', section.page_end)
      .order('page_no');
    if (pagesError) throw new Error(pagesError.message);

    const text = (pages ?? []).map((p) => p.text).join('\n')
      .slice(0, detailed ? MAX_INPUT_CHARS_DETAILED : MAX_INPUT_CHARS_CONCISE);
    if (text.trim().length < 100) throw new Error('section has no extractable text');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: detailed ? 5000 : 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: detailed ? DETAILED_PROMPT : CONCISE_PROMPT },
          {
            role: 'user',
            content: `Named section${section.label ? ` ${section.label}` : ''}: "${section.title}" (cover only this section's material)\n\nPage text:\n${text}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
    const raw: RawCard[] = Array.isArray(parsed?.cards) ? parsed.cards : [];

    const rows: any[] = [];
    for (const c of raw) {
      if (rows.length >= (detailed ? 20 : 10)) break;
      if (c.kind === 'quiz') {
        const quiz = validQuiz(c);
        if (quiz) {
          rows.push({ kind: 'quiz', title: 'Quick check', body: '', quiz, visual: null });
        }
      } else if (c.title?.trim() && c.body?.trim()) {
        rows.push({
          kind: 'content',
          title: cleanDashes(c.title.trim()).slice(0, 200),
          body: cleanDashes(c.body.trim()),
          visual: validVisual(c.visual),
          quiz: null,
        });
      }
    }
    if (rows.filter((r) => r.kind === 'content').length === 0) throw new Error('model returned no cards');

    // Append the book's own figures from this page range, in page order.
    const { data: figures } = await sb
      .from('book_figures')
      .select('storage_path, page_no, width, height')
      .eq('book_id', section.book_id)
      .gte('page_no', section.page_start)
      .lte('page_no', section.page_end)
      .order('page_no')
      .limit(MAX_FIGURE_CARDS);
    for (const f of figures ?? []) {
      rows.push({
        kind: 'figure',
        title: `Figure, page ${f.page_no + 1}`,
        body: 'From the book itself.',
        figure: { path: f.storage_path, page: f.page_no, width: f.width, height: f.height },
        visual: null,
        quiz: null,
      });
    }

    const { error: insError } = await sb.from('section_cards').insert(
      rows.map((r, i) => ({
        section_id,
        owner_id: section.owner_id,
        order_index: i,
        model: MODEL,
        ...r,
      })),
    );
    if (insError) throw new Error(insError.message);

    await sb.from('book_sections').update({ card_status: 'ready' }).eq('id', section_id);
    return json({ status: 'ready', cards: rows.length });
  } catch (e) {
    await sb.from('book_sections').update({ card_status: 'failed' }).eq('id', section_id);
    return json({ status: 'failed', error: String(e instanceof Error ? e.message : e).slice(0, 300) });
  }
});
