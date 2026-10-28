// Turns one book section's pages into a swipeable feed of study cards, on first
// visit, then cached forever in section_cards. Idempotent: a second call while
// generating (or after ready) just reports status; the client polls.
// The book's card_mode controls depth: 'concise' summarizes, 'detailed' covers
// everything in the text. Cards may carry a simple visual (flow or compare).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyUser, json, corsHeaders } from '../_shared/userAuth.ts';

const MODEL = 'gpt-4o-mini';
const MAX_INPUT_CHARS_CONCISE = 12_000;
const MAX_INPUT_CHARS_DETAILED = 24_000;

const BASE_RULES = `Each card: a punchy title (max 8 words) and a body of 60-130 words. The body may use simple markdown: **bold** for key terms, and short bullet lists with "- ". No headings, no emoji, no "In this section". Never use em dashes or en dashes; use commas or periods. Write like an excellent teacher: concrete, direct, zero filler.

A card may OPTIONALLY include a "visual" when it genuinely clarifies the material (at most 2 visuals per section):
- {"type":"flow","steps":["step 1","step 2","step 3"]} for a process or pipeline (3-5 short steps)
- {"type":"compare","left":{"label":"...","points":["..."]},"right":{"label":"...","points":["..."]}} for contrasting two things (2-3 points each side)

Reply ONLY with JSON: {"cards":[{"title":"...","body":"...","visual":{...} or omit}]}`;

const CONCISE_PROMPT = `You turn a textbook section into a short swipeable feed of study cards for a mobile app. Produce 3-6 cards that teach the material in a sensible order: the core idea in plain language, then the key points or mechanism, then a concrete example, and a quick recap or common pitfall if the material warrants it.

${BASE_RULES}`;

const DETAILED_PROMPT = `You turn a textbook section into a swipeable feed of study cards for a mobile app. Cover EVERYTHING of substance in the text, in reading order: every concept, definition, mechanism, example, formula, and caveat gets represented. Produce as many cards as the material needs (typically 6-14). Do not skip content to save space; split dense material across multiple cards instead.

${BASE_RULES}`;

interface RawCard {
  title?: string;
  body?: string;
  visual?: { type?: string; steps?: unknown; left?: unknown; right?: unknown };
}

function cleanDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ', ').replace(/, ,/g, ',');
}

function validVisual(v: RawCard['visual']): object | null {
  if (!v || typeof v !== 'object') return null;
  if (v.type === 'flow' && Array.isArray(v.steps) && v.steps.length >= 2) {
    const steps = v.steps.filter((x) => typeof x === 'string' && x.trim()).slice(0, 6);
    return steps.length >= 2 ? { type: 'flow', steps } : null;
  }
  if (v.type === 'compare') {
    const side = (x: any) =>
      x && typeof x.label === 'string' && Array.isArray(x.points)
        ? { label: x.label.slice(0, 40), points: x.points.filter((p: unknown) => typeof p === 'string').slice(0, 4) }
        : null;
    const left = side(v.left);
    const right = side(v.right);
    return left && right && left.points.length && right.points.length
      ? { type: 'compare', left, right }
      : null;
  }
  return null;
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

  // Claim: only one request generates; concurrent callers see 'generating'.
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
        max_tokens: detailed ? 4000 : 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: detailed ? DETAILED_PROMPT : CONCISE_PROMPT },
          {
            role: 'user',
            content: `Section${section.label ? ` ${section.label}` : ''}: "${section.title}"\n\n${text}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
    const cards: RawCard[] = Array.isArray(parsed?.cards) ? parsed.cards : [];
    const valid = cards
      .filter((c) => c.title?.trim() && c.body?.trim())
      .slice(0, detailed ? 16 : 8);
    if (valid.length === 0) throw new Error('model returned no cards');

    const { error: insError } = await sb.from('section_cards').insert(
      valid.map((c, i) => ({
        section_id,
        owner_id: section.owner_id,
        order_index: i,
        title: cleanDashes(c.title!.trim()).slice(0, 200),
        body: cleanDashes(c.body!.trim()),
        visual: validVisual(c.visual),
        model: MODEL,
      })),
    );
    if (insError) throw new Error(insError.message);

    await sb.from('book_sections').update({ card_status: 'ready' }).eq('id', section_id);
    return json({ status: 'ready', cards: valid.length });
  } catch (e) {
    await sb.from('book_sections').update({ card_status: 'failed' }).eq('id', section_id);
    return json({ status: 'failed', error: String(e instanceof Error ? e.message : e).slice(0, 300) });
  }
});
