// Writes the AI headline + summary + category for new articles, server-side,
// once per article for every reader (replaces the per-device enhancement in
// src/lib/aiService.ts). Cron: every 5 minutes, offset from extract-articles.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkCronSecret } from '../_shared/cronAuth.ts';

const BATCH_SIZE = 20;
const CONCURRENCY = 4;
const MODEL = 'gpt-4o-mini';
const MAX_INPUT_CHARS = 6000;

const CATEGORIES = ['AI', 'Robotics', 'Dev', 'Startups', 'Security', 'Science', 'Repos'];

// Same editor voice as the client's enhanceOne prompt, extended with category
// and the date of the underlying event (for freshness display in the app).
const SYSTEM_PROMPT = `You are a senior editor at a respected tech publication. Today is {{TODAY}}. For every article you receive, produce four things:

HEADLINE: A precise, declarative headline, max 12 words. Strip any "Ask HN:", "Show HN:", "[pdf]", "[video]" prefixes. State the specific who and what. No clickbait, no vague phrasing. Example: "OpenAI Releases GPT-5 With Significantly Improved Reasoning"

SUMMARY: 75-90 words. Write like The Economist or MIT Technology Review: authoritative, clear, no hype. Third person. One tight paragraph. Lead with the most important fact. Cover what happened, who is involved, the key detail, and why it matters to a technical reader. When the article describes a dated event (a launch, release, announcement, incident), state when it happened. For a GitHub repository, explain what the project does and why it is getting attention. Do NOT open with "In this article", "This article", the headline, or a restatement of the title. No bullet points. No emoji. Never use em dashes or en dashes; use commas or periods instead.

CATEGORY: Exactly one of: AI, Robotics, Dev, Startups, Security, Science, Repos. Robotics covers robots, humanoids, drones, autonomous vehicles, and robotics hardware.

EVENT_DATE: The date the underlying event actually happened, as YYYY-MM-DD, ONLY if the article text states or clearly implies it. If the piece is not about a dated event, or the date is not evident, use null. Never guess.

Reply ONLY with this JSON (no markdown, no extra text):
{"headline":"...","summary":"...","category":"...","event_date":"YYYY-MM-DD or null"}`;

interface ArticleRow {
  id: string;
  title: string;
  raw_summary: string | null;
  source_kind: string;
  source_name: string;
  category: string;
}

function cleanDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ', ').replace(/, ,/g, ',');
}

async function summarizeOne(
  a: ArticleRow,
  extractedText: string | null,
  apiKey: string,
): Promise<{ ai_title: string; ai_summary: string; category: string; ai_event_date: string | null } | null> {
  const body = extractedText
    ? `Article text (may be truncated):\n${extractedText.slice(0, MAX_INPUT_CHARS)}`
    : `Snippet: ${a.raw_summary ?? '(no description available)'}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT.replace('{{TODAY}}', new Date().toISOString().slice(0, 10)) },
        { role: 'user', content: `Source: ${a.source_name}\nTitle: "${a.title}"\n${body}` },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content ?? '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const parsed = JSON.parse(match[0]) as {
    headline?: string; summary?: string; category?: string; event_date?: string | null;
  };
  if (!parsed.headline?.trim() || !parsed.summary?.trim()) return null;
  const eventDate = typeof parsed.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.event_date)
    ? parsed.event_date
    : null;
  return {
    ai_title: cleanDashes(parsed.headline.trim()),
    ai_summary: cleanDashes(parsed.summary.trim()),
    category: CATEGORIES.includes(parsed.category ?? '') ? parsed.category! : a.category,
    ai_event_date: eventDate,
  };
}

Deno.serve(async (req) => {
  const authError = checkCronSecret(req);
  if (authError) return authError;

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), { status: 500 });
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: batch, error } = await sb.rpc('claim_summarize_batch', { batch_size: BATCH_SIZE });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  const rows = (batch as ArticleRow[] | null) ?? [];

  // One round trip for all the extracted texts in the batch.
  const { data: contents } = await sb
    .from('article_contents')
    .select('article_id, extracted_text')
    .in('article_id', rows.map((r) => r.id));
  const textById = new Map((contents ?? []).map((c) => [c.article_id, c.extracted_text as string]));

  let done = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    await Promise.allSettled(rows.slice(i, i + CONCURRENCY).map(async (a) => {
      try {
        const result = await summarizeOne(a, textById.get(a.id) ?? null, apiKey);
        if (!result) throw new Error('bad model output');
        await sb.from('articles').update({
          ...result,
          ai_status: 'done',
          ai_model: MODEL,
          ai_generated_at: new Date().toISOString(),
        }).eq('id', a.id);
        done++;
      } catch {
        await sb.from('articles').update({ ai_status: 'failed' }).eq('id', a.id);
        failed++;
      }
    }));
  }

  return new Response(JSON.stringify({ claimed: rows.length, done, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
