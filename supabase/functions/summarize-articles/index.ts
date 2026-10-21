// Writes the AI headline + summary + category for new articles, server-side,
// once per article for every reader (replaces the per-device enhancement in
// src/lib/aiService.ts). Cron: every 5 minutes, offset from extract-articles.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { checkCronSecret } from '../_shared/cronAuth.ts';

const BATCH_SIZE = 20;
const CONCURRENCY = 4;
const MODEL = 'gpt-4o-mini';
const MAX_INPUT_CHARS = 6000;

const CATEGORIES = ['AI', 'Dev', 'Startups', 'Security', 'Science', 'Repos'];

// Same editor voice as the client's enhanceOne prompt, extended with category.
const SYSTEM_PROMPT = `You are a senior editor at a respected tech publication. For every article you receive, produce three things:

HEADLINE — A precise, declarative headline, max 12 words. Strip any "Ask HN:", "Show HN:", "[pdf]", "[video]" prefixes. State the specific who and what. No clickbait, no vague phrasing. Example: "OpenAI Releases GPT-5 With Significantly Improved Reasoning"

SUMMARY — 75–90 words. Write like The Economist or MIT Technology Review: authoritative, clear, no hype. Third person. One tight paragraph. Lead with the most important fact. Cover what happened, who is involved, the key detail, and why it matters to a technical reader. Do NOT open with "In this article", "This article", the headline, or a restatement of the title. No bullet points. No emoji.

CATEGORY — Exactly one of: AI, Dev, Startups, Security, Science, Repos.

Reply ONLY with this JSON (no markdown, no extra text):
{"headline":"...","summary":"...","category":"..."}`;

interface ArticleRow {
  id: string;
  title: string;
  raw_summary: string | null;
  source_kind: string;
  source_name: string;
  category: string;
}

async function summarizeOne(
  a: ArticleRow,
  extractedText: string | null,
  apiKey: string,
): Promise<{ ai_title: string; ai_summary: string; category: string } | null> {
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
        { role: 'system', content: SYSTEM_PROMPT },
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
  const parsed = JSON.parse(match[0]) as { headline?: string; summary?: string; category?: string };
  if (!parsed.headline?.trim() || !parsed.summary?.trim()) return null;
  return {
    ai_title: parsed.headline.trim(),
    ai_summary: parsed.summary.trim(),
    category: CATEGORIES.includes(parsed.category ?? '') ? parsed.category! : a.category,
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
