// Fetches each new article's page and stores clean extracted text (private,
// service-role-only table) for the summarizer. Respects robots.txt. Also
// backfills og:image from the same HTML so the app never scrapes per-card.
// Cron: every 5 minutes.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Readability } from 'npm:@mozilla/readability@0.5.0';
import { parseHTML } from 'npm:linkedom@0.18.5';
import robotsParser from 'npm:robots-parser@3.0.1';
import { checkCronSecret } from '../_shared/cronAuth.ts';

const UA = 'FiniteSocialBot/1.0 (+https://github.com/slay-a/finite-social)';
const BATCH_SIZE = 15;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_CHARS = 40_000;
const MAX_ATTEMPTS = 3;

interface ArticleRow {
  id: string;
  url: string;
  source_kind: string;
  raw_summary: string | null;
  image_url: string | null;
  extract_attempts: number;
}

const robotsCache = new Map<string, ReturnType<typeof robotsParser> | null>();

async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const origin = new URL(url).origin;
    if (!robotsCache.has(origin)) {
      try {
        const res = await fetch(`${origin}/robots.txt`, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(5000),
        });
        robotsCache.set(
          origin,
          res.ok ? robotsParser(`${origin}/robots.txt`, await res.text()) : null,
        );
      } catch {
        robotsCache.set(origin, null); // unreachable robots.txt -> allow
      }
    }
    const robots = robotsCache.get(origin);
    if (!robots) return true;
    return robots.isAllowed(url, UA) !== false;
  } catch {
    return true;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('html')) throw new Error(`not html: ${type}`);

  const reader = res.body!.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel().catch(() => {});
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { buf.set(c, offset); offset += c.length; }
  return new TextDecoder('utf-8', { fatal: false }).decode(buf);
}

// Same og:image tags the app's src/lib/ogImage.ts looks for.
function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]?.startsWith('http')) return m[1];
  }
  return null;
}

Deno.serve(async (req) => {
  const authError = checkCronSecret(req);
  if (authError) return authError;

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: batch, error } = await sb.rpc('claim_extract_batch', { batch_size: BATCH_SIZE });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: Record<string, string> = {};

  await Promise.allSettled((batch as ArticleRow[] ?? []).map(async (a) => {
    // Reddit self-posts and other on-platform text: the snippet is the content.
    let host = '';
    try { host = new URL(a.url).hostname; } catch { /* fall through to skipped */ }
    if (!host || host.endsWith('reddit.com') || host.endsWith('news.ycombinator.com') || host.endsWith('lobste.rs')) {
      await sb.from('articles').update({ extract_status: 'skipped' }).eq('id', a.id);
      results[a.id] = 'skipped';
      return;
    }

    try {
      if (!(await isAllowedByRobots(a.url))) {
        await sb.from('articles').update({ extract_status: 'robots_blocked' }).eq('id', a.id);
        results[a.id] = 'robots_blocked';
        return;
      }

      const html = await fetchHtml(a.url);

      const { document } = parseHTML(html);
      const parsed = new Readability(document as unknown as Document).parse();
      const text = (parsed?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_CHARS);
      if (text.length < 200) throw new Error('extraction too short');

      await sb.from('article_contents').upsert({
        article_id: a.id,
        extracted_text: text,
        word_count: text.split(/\s+/).length,
        extracted_at: new Date().toISOString(),
      });

      const ogImage = a.image_url ? null : extractOgImage(html);
      await sb.from('articles').update({
        extract_status: 'done',
        ...(ogImage ? { image_url: ogImage } : {}),
      }).eq('id', a.id);
      results[a.id] = 'done';
    } catch (e) {
      const attempts = a.extract_attempts + 1;
      await sb.from('articles').update({
        extract_attempts: attempts,
        extract_status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
      }).eq('id', a.id);
      results[a.id] = `error: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`;
    }
  }));

  return new Response(JSON.stringify({ claimed: batch?.length ?? 0, results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
