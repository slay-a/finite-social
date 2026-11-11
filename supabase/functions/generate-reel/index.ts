// Writes the Watch-mode screenplay for one section: a sequence of typed scenes
// (title, points, diagram, stat, quote, figure) each with one or two short
// conversational narration sentences, generated from the section's study cards
// and cached on book_sections.reel_script. Idempotent: once ready, later calls
// just return the stored script.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyUser, json, corsHeaders } from '../_shared/userAuth.ts';

const MODEL = 'gpt-4o-mini';

const PROMPT = `You are directing a short vertical reel (like TikTok or Instagram) that teaches one section of a document. You get the section's study cards; you write the screenplay: 5 to 10 scenes, each with narration that a charismatic narrator SPEAKS while the scene animates.

NARRATION rules: 1-2 short conversational sentences per scene (max 30 words). Spoken language, not written: contractions, direct address, momentum ("Here's where it gets interesting.", "So how do we score a claim?"). Each scene's narration flows from the previous one, telling one continuous story. Never read labels aloud verbatim; the visuals show them. Never use em dashes or en dashes. Never say "in this scene" or "as you can see".

SCENES, in JSON:
- {"type":"title","narration":"...","words":["Claim-level","hallucination","evaluation"],"accent":1} : 2-6 big words on screen, accent = index of the one word to highlight. Open the reel with one of these.
- {"type":"points","narration":"...","title":"short heading","points":["...","..."]} : 2-4 punchy phrases (max 8 words each) that pop in one by one.
- {"type":"diagram","narration":"...","title":"short heading","nodes":[{"id":"a","label":"NLI judge","tone":"accent","row":0}],"edges":[{"from":"a","to":"b","label":"scores"}]} : 2-7 nodes in rows (row 0 = top), tone one of "accent","good","bad","neutral". Edges connect node ids top-down, label optional (1-2 words). Use for any process, pipeline, comparison, or structure.
- {"type":"stat","narration":"...","value":"87%","label":"claims supported"} : one big number from the material, never invented.
- {"type":"quote","narration":"...","text":"short verbatim or formula","source":"optional"} : a key sentence, definition, or formula shown large. Put formulas here using $...$ notation from the cards.
- {"type":"figure","narration":"...","figureCardId":"<id>"} : shows that figure card's image. Only use ids from the FIGURE CARDS list; skip this type if the list is empty.

STRUCTURE: open with a title scene hooking the topic, develop with diagrams/points/stats/quotes in the order the material builds, close with a quick payoff scene (points or title) that lands the takeaway. Prefer diagram scenes whenever the material has any structure; reels live on motion. Stay faithful to the cards: never invent numbers, names, or claims.

Reply ONLY with JSON: {"scenes":[...]}`;

const TONES = ['accent', 'good', 'bad', 'neutral'];

function cleanDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ', ').replace(/, ,/g, ',');
}

function str(x: unknown, max: number): string | null {
  return typeof x === 'string' && x.trim() ? cleanDashes(x.trim()).slice(0, max) : null;
}

function strList(x: unknown, maxItems: number, maxLen: number): string[] {
  return Array.isArray(x)
    ? x.filter((s) => typeof s === 'string' && s.trim()).map((s) => cleanDashes(s.trim()).slice(0, maxLen)).slice(0, maxItems)
    : [];
}

function validScene(raw: any, figureIds: Set<string>): object | null {
  if (!raw || typeof raw !== 'object') return null;
  const narration = str(raw.narration, 260);
  if (!narration) return null;

  if (raw.type === 'title') {
    const words = strList(raw.words, 6, 24);
    if (words.length < 2) return null;
    const accent = Number.isInteger(raw.accent) && raw.accent >= 0 && raw.accent < words.length ? raw.accent : 0;
    return { type: 'title', narration, words, accent };
  }
  if (raw.type === 'points') {
    const points = strList(raw.points, 4, 60);
    if (points.length < 2) return null;
    return { type: 'points', narration, title: str(raw.title, 40) ?? '', points };
  }
  if (raw.type === 'diagram') {
    const nodes = Array.isArray(raw.nodes)
      ? raw.nodes
          .map((n: any) => {
            const id = str(n?.id, 24);
            const label = str(n?.label, 30);
            if (!id || !label) return null;
            return {
              id,
              label,
              tone: TONES.includes(n?.tone) ? n.tone : 'neutral',
              row: Number.isInteger(n?.row) && n.row >= 0 && n.row <= 5 ? n.row : 0,
            };
          })
          .filter(Boolean)
          .slice(0, 7)
      : [];
    if (nodes.length < 2) return null;
    const ids = new Set(nodes.map((n: any) => n.id));
    const edges = Array.isArray(raw.edges)
      ? raw.edges
          .map((e: any) => {
            const from = str(e?.from, 24);
            const to = str(e?.to, 24);
            if (!from || !to || !ids.has(from) || !ids.has(to) || from === to) return null;
            return { from, to, label: str(e?.label, 20) ?? undefined };
          })
          .filter(Boolean)
          .slice(0, 10)
      : [];
    return { type: 'diagram', narration, title: str(raw.title, 40) ?? '', nodes, edges };
  }
  if (raw.type === 'stat') {
    const value = str(raw.value, 14);
    const label = str(raw.label, 60);
    if (!value || !label) return null;
    return { type: 'stat', narration, value, label };
  }
  if (raw.type === 'quote') {
    const text = str(raw.text, 220);
    if (!text) return null;
    return { type: 'quote', narration, text, source: str(raw.source, 60) ?? undefined };
  }
  if (raw.type === 'figure') {
    const figureCardId = str(raw.figureCardId, 40);
    if (!figureCardId || !figureIds.has(figureCardId)) return null;
    return { type: 'figure', narration, figureCardId };
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const auth = await verifyUser(req);
    if (auth instanceof Response) return auth;

    try {
      const { sectionId } = await req.json();
      if (!sectionId) return json({ error: 'sectionId required' }, 400);

      const sb = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { data: section } = await sb
        .from('book_sections')
        .select('id, owner_id, title, label, card_status, reel_script, reel_status')
        .eq('id', sectionId)
        .single();
      if (!section || section.owner_id !== auth.userId) return json({ error: 'not found' }, 404);
      if (section.reel_script) return json({ status: 'ready', script: section.reel_script });
      if (section.card_status !== 'ready') return json({ status: 'cards_not_ready' });

      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) return json({ error: 'NOT_CONFIGURED' });

      const { data: cards } = await sb
        .from('section_cards')
        .select('id, kind, title, body, visual, quiz, figure')
        .eq('section_id', sectionId)
        .order('order_index');
      if (!cards?.length) return json({ status: 'cards_not_ready' });

      const figureCards = cards.filter((c) => c.kind === 'figure');
      const figureIds = new Set(figureCards.map((c) => c.id));
      const material = cards
        .filter((c) => c.kind !== 'figure')
        .map((c) => {
          if (c.kind === 'quiz' && c.quiz) {
            return `QUIZ: ${c.quiz.question} Answer: ${c.quiz.options?.[c.quiz.answer] ?? ''}`;
          }
          const visual = c.visual ? ` VISUAL:${JSON.stringify(c.visual)}` : '';
          return `CARD: ${c.title}\n${c.body}${visual}`;
        })
        .join('\n\n')
        .slice(0, 16_000);
      const figureList = figureCards.length
        ? figureCards.map((c) => `${c.id} (page ${(c.figure?.page ?? 0) + 1})`).join(', ')
        : 'none';

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.7,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: PROMPT },
            {
              role: 'user',
              content: `SECTION: ${section.label ? `${section.label} ` : ''}${section.title}\n\nFIGURE CARDS: ${figureList}\n\nSTUDY CARDS:\n\n${material}`,
            },
          ],
        }),
      });
      if (!res.ok) {
        await sb.from('book_sections').update({ reel_status: 'failed' }).eq('id', sectionId);
        return json({ status: 'failed', error: `openai ${res.status}` });
      }
      const data = await res.json();
      let parsed: any = {};
      try { parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}'); } catch {}
      const scenes = Array.isArray(parsed.scenes)
        ? parsed.scenes.map((s: any) => validScene(s, figureIds)).filter(Boolean).slice(0, 12)
        : [];

      if (scenes.length < 3) {
        await sb.from('book_sections').update({ reel_status: 'failed' }).eq('id', sectionId);
        return json({ status: 'failed', error: 'too few valid scenes' });
      }

      const script = { v: 1, scenes };
      await sb.from('book_sections')
        .update({ reel_script: script, reel_status: 'ready' })
        .eq('id', sectionId);
      return json({ status: 'ready', script });
    } catch (e) {
      return json({ error: String(e) }, 500);
    }
});
