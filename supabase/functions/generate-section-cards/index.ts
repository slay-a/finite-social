// Turns one book section's pages into 3-6 scrollable study cards, on first
// visit, then cached forever in section_cards. Idempotent: a second call while
// generating (or after ready) just reports status; the client polls.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyUser, json, corsHeaders } from '../_shared/userAuth.ts';

const MODEL = 'gpt-4o-mini';
const MAX_INPUT_CHARS = 12_000;

const SYSTEM_PROMPT = `You turn a textbook section into a short swipeable feed of study cards for a mobile app. Given the section text, produce 3-6 cards that teach the material in a sensible order: start with the core idea in plain language, then the key points or mechanism, then a concrete example or application, and end with a quick recap or common pitfall if the material warrants it.

Each card: a punchy title (max 8 words) and a body of 60-120 words. The body may use simple markdown: **bold** for key terms, and short bullet lists with "- ". No headings, no emoji, no "In this section". Write like an excellent teacher: concrete, direct, zero filler.

Reply ONLY with JSON: {"cards":[{"title":"...","body":"..."}]}`;

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
    const { data: pages, error: pagesError } = await sb
      .from('book_pages')
      .select('text')
      .eq('book_id', section.book_id)
      .gte('page_no', section.page_start)
      .lte('page_no', section.page_end)
      .order('page_no');
    if (pagesError) throw new Error(pagesError.message);

    const text = (pages ?? []).map((p) => p.text).join('\n').slice(0, MAX_INPUT_CHARS);
    if (text.trim().length < 100) throw new Error('section has no extractable text');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Section${section.label ? ` ${section.label}` : ''}: "${section.title}"\n\n${text}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
    const cards: Array<{ title?: string; body?: string }> =
      Array.isArray(parsed?.cards) ? parsed.cards : [];
    const valid = cards.filter((c) => c.title?.trim() && c.body?.trim()).slice(0, 8);
    if (valid.length === 0) throw new Error('model returned no cards');

    const { error: insError } = await sb.from('section_cards').insert(
      valid.map((c, i) => ({
        section_id,
        owner_id: section.owner_id,
        order_index: i,
        title: c.title!.trim().slice(0, 200),
        body: c.body!.trim(),
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
