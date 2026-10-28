// Polls the curated source list (sources table) and upserts normalized
// articles. Triggered by pg_cron every 15 minutes (see feed_cron migration).
// Deno ports of the client fetchers in src/lib/{rssApi,hnApi,redditApi,
// devtoApi,lobstersApi,githubApi}.ts — keep behavior in sync.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { XMLParser } from 'npm:fast-xml-parser@4.5.0';
import { checkCronSecret } from '../_shared/cronAuth.ts';
import { detectCategory, titleDedupeKey, type Category } from '../_shared/categoryDetect.ts';

interface SourceRow {
  id: string;
  kind: 'rss' | 'hn' | 'reddit' | 'devto' | 'lobsters' | 'github' | 'guardian';
  name: string;
  short_name: string;
  feed_url: string | null;
  etag: string | null;
  last_modified: string | null;
  last_polled_at: string | null;
  poll_interval_minutes: number;
  consecutive_errors: number;
}

interface NormalizedArticle {
  source_id: string;
  source_kind: string;
  source_name: string;
  external_id: string;
  url: string;
  title: string;
  title_dedupe_key: string;
  raw_summary: string | null;
  author: string | null;
  tags: string[];
  category: Category;
  published_at: string;
  points: number | null;
  comment_count: number | null;
  image_url: string | null;
}

const UA = { 'User-Agent': 'FiniteSocialBot/1.0 (+https://github.com/slay-a/finite-social)' };
const MAX_SOURCES_PER_RUN = 35;

function toIso(raw: unknown): string {
  const d = new Date(String(raw ?? ''));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').trim();
}

function base(src: SourceRow, a: {
  external_id: string; url: string; title: string;
  raw_summary?: string | null; author?: string | null; tags?: string[];
  category?: Category; published_at: string;
  points?: number | null; comment_count?: number | null; image_url?: string | null;
}): NormalizedArticle {
  return {
    source_id: src.id,
    source_kind: src.kind,
    source_name: src.name,
    external_id: a.external_id,
    url: a.url,
    title: a.title,
    title_dedupe_key: titleDedupeKey(a.title),
    raw_summary: a.raw_summary ?? null,
    author: a.author ?? null,
    tags: (a.tags ?? []).slice(0, 5),
    category: a.category ?? detectCategory(a.title, a.tags ?? []),
    published_at: a.published_at,
    points: a.points ?? null,
    comment_count: a.comment_count ?? null,
    image_url: a.image_url ?? null,
  };
}

// ---------------------------------------------------------------------- RSS
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item' || name === 'entry',
});

async function fetchRss(src: SourceRow): Promise<{ articles: NormalizedArticle[]; etag?: string; lastModified?: string; notModified?: boolean }> {
  const headers: Record<string, string> = { ...UA };
  if (src.etag) headers['If-None-Match'] = src.etag;
  if (src.last_modified) headers['If-Modified-Since'] = src.last_modified;

  const res = await fetch(src.feed_url!, { headers, signal: AbortSignal.timeout(10000) });
  if (res.status === 304) return { articles: [], notModified: true };
  if (!res.ok) throw new Error(`RSS ${src.name} HTTP ${res.status}`);

  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const channel = parsed?.rss?.channel ?? parsed?.feed;
  const items: any[] = channel?.item ?? channel?.entry ?? [];

  const articles = items.slice(0, 25).flatMap((item: any): NormalizedArticle[] => {
    const title = stripHtml(typeof item.title === 'object' ? item.title['#text'] ?? '' : item.title ?? '');
    if (!title) return [];

    const url =
      item.link?.['@_href'] ??
      (typeof item.link === 'string' ? item.link : item.link?.['#text']) ??
      item.id ?? '';
    if (!url || !String(url).startsWith('http')) return [];

    const guidRaw = item.guid;
    const guid = typeof guidRaw === 'object' ? guidRaw?.['#text'] : guidRaw;
    const rawDesc = item['content:encoded'] ?? item.description ?? item.summary ?? item.content?.['#text'] ?? '';
    const imageUrl =
      item['media:content']?.['@_url'] ??
      item['media:thumbnail']?.['@_url'] ??
      item.enclosure?.['@_url'] ??
      String(rawDesc).match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null;

    const tags: string[] = [];
    if (item.category) {
      for (const c of Array.isArray(item.category) ? item.category : [item.category]) {
        const t = typeof c === 'string' ? c : c?.['#text'] ?? '';
        if (t) tags.push(String(t).toLowerCase());
      }
    }

    return [base(src, {
      external_id: String(guid ?? url),
      url: String(url),
      title,
      raw_summary: stripHtml(String(rawDesc)).slice(0, 220).trim() || title,
      author: item['dc:creator'] ?? item.author?.name ??
        (typeof item.author === 'string' ? item.author : null) ?? src.name,
      tags,
      published_at: toIso(item.pubDate ?? item.published ?? item.updated ?? item['dc:date']),
      image_url: imageUrl,
    })];
  });

  return {
    articles,
    etag: res.headers.get('etag') ?? undefined,
    lastModified: res.headers.get('last-modified') ?? undefined,
  };
}

// ----------------------------------------------------------------------- HN
const HN_QUERIES = [
  'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=20',
  'https://hn.algolia.com/api/v1/search?tags=story&query=AI+machine+learning+LLM&hitsPerPage=10',
  'https://hn.algolia.com/api/v1/search?tags=story&query=security+vulnerability+breach&hitsPerPage=10',
  'https://hn.algolia.com/api/v1/search?tags=story&query=startup+YC+founder&hitsPerPage=10',
];

async function fetchHn(src: SourceRow): Promise<NormalizedArticle[]> {
  const out: NormalizedArticle[] = [];
  for (const q of HN_QUERIES) {
    const res = await fetch(q, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) continue;
    const data = await res.json() as { hits: any[] };
    for (const h of data.hits) {
      const title = (h.title || h.story_title || '').trim();
      if (!title || (!h.url && !h.story_text)) continue;
      const tags = (h._tags ?? []).filter((t: string) => !t.startsWith('author_') && !t.startsWith('story_'));
      out.push(base(src, {
        external_id: String(h.objectID),
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        title,
        raw_summary: h.story_text
          ? stripHtml(h.story_text).slice(0, 220)
          : `${h.points ?? 0} points · ${h.num_comments ?? 0} comments on Hacker News`,
        author: h.author,
        tags,
        published_at: toIso(h.created_at),
        points: h.points ?? null,
        comment_count: h.num_comments ?? null,
      }));
    }
  }
  return out;
}

// ------------------------------------------------------------------- Reddit
const REDDIT_SUBS: Array<{ sub: string; category: Category }> = [
  { sub: 'technology', category: 'Dev' },
  { sub: 'programming', category: 'Dev' },
  { sub: 'webdev', category: 'Dev' },
  { sub: 'MachineLearning', category: 'AI' },
  { sub: 'artificial', category: 'AI' },
  { sub: 'ChatGPT', category: 'AI' },
  { sub: 'startups', category: 'Startups' },
  { sub: 'YCombinator', category: 'Startups' },
  { sub: 'netsec', category: 'Security' },
  { sub: 'cybersecurity', category: 'Security' },
  { sub: 'science', category: 'Science' },
  { sub: 'Futurology', category: 'Science' },
];

async function fetchReddit(src: SourceRow): Promise<NormalizedArticle[]> {
  // Rotate 4 subs per run to stay light; the 15-min cron covers the full list hourly.
  const offset = Math.floor(Date.now() / (15 * 60 * 1000)) % REDDIT_SUBS.length;
  const picked = Array.from({ length: 4 }, (_, i) => REDDIT_SUBS[(offset + i) % REDDIT_SUBS.length]);

  const out: NormalizedArticle[] = [];
  let anyOk = false;
  for (const { sub, category } of picked) {
    const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=20&raw_json=1`, {
      headers: UA, signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) continue;
    anyOk = true;
    const data = await res.json() as { data: { children: Array<{ data: any }> } };
    for (const { data: p } of data.data.children) {
      if (!p.title || p.author === 'AutoModerator' || p.title.startsWith('[')) continue;
      const imageUrl = p.preview?.images?.[0]?.source?.url
        ? String(p.preview.images[0].source.url).replace(/&amp;/g, '&')
        : (p.thumbnail?.startsWith('http') ? p.thumbnail : null);
      out.push(base(src, {
        external_id: String(p.id),
        url: p.is_self ? `https://reddit.com${p.permalink}` : p.url,
        title: p.title,
        raw_summary: p.selftext
          ? String(p.selftext).replace(/\n+/g, ' ').slice(0, 240).trim()
          : `${p.score?.toLocaleString?.() ?? p.score} upvotes · ${p.num_comments} comments on r/${p.subreddit}`,
        author: `u/${p.author}`,
        tags: p.link_flair_text ? [p.link_flair_text] : [p.subreddit],
        category,
        published_at: toIso(p.created_utc * 1000),
        points: p.score ?? null,
        comment_count: p.num_comments ?? null,
        image_url: imageUrl,
      }));
    }
  }
  // Reddit blocks many datacenter IPs; surface that as an error so backoff kicks in.
  if (!anyOk) throw new Error('Reddit: all subreddit fetches failed (likely IP blocked)');
  return out;
}

// -------------------------------------------------------------------- DEV.to
const DEVTO_QUERIES: Array<{ url: string; category: Category | null }> = [
  { url: 'https://dev.to/api/articles?top=7&per_page=20', category: null },
  { url: 'https://dev.to/api/articles?tag=ai&per_page=10', category: 'AI' },
  { url: 'https://dev.to/api/articles?tag=security&per_page=10', category: 'Security' },
];

async function fetchDevto(src: SourceRow): Promise<NormalizedArticle[]> {
  const out: NormalizedArticle[] = [];
  for (const { url, category } of DEVTO_QUERIES) {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) continue;
    const data = await res.json() as any[];
    for (const a of data) {
      if (!a.title || !a.description) continue;
      out.push(base(src, {
        external_id: String(a.id),
        url: a.canonical_url || a.url,
        title: a.title,
        raw_summary: a.description,
        author: a.user?.name || a.user?.username || null,
        tags: a.tag_list ?? [],
        category: category ?? undefined,
        published_at: toIso(a.published_at),
        points: a.positive_reactions_count ?? null,
        comment_count: a.comments_count ?? null,
        image_url: a.cover_image ?? a.social_image ?? null,
      }));
    }
  }
  return out;
}

// ------------------------------------------------------------------ Lobsters
const LOBSTERS_QUERIES = [
  'https://lobste.rs/hottest.json',
  'https://lobste.rs/t/ai.json',
  'https://lobste.rs/t/security.json',
];

async function fetchLobsters(src: SourceRow): Promise<NormalizedArticle[]> {
  const out: NormalizedArticle[] = [];
  for (const q of LOBSTERS_QUERIES) {
    const res = await fetch(q, { headers: UA, signal: AbortSignal.timeout(10000) });
    if (!res.ok) continue;
    const data = await res.json() as any[];
    for (const s of data) {
      if (!s.url || !s.title) continue;
      out.push(base(src, {
        external_id: String(s.short_id),
        url: s.url || `https://lobste.rs/s/${s.short_id}`,
        title: s.title,
        raw_summary: s.description
          ? stripHtml(s.description).slice(0, 220).trim()
          : `${s.score} points · ${s.comment_count} comments on Lobsters`,
        author: s.submitter_user?.username ?? null,
        tags: s.tags ?? [],
        published_at: toIso(s.created_at),
        points: s.score ?? null,
        comment_count: s.comment_count ?? null,
      }));
    }
  }
  return out;
}

// -------------------------------------------------------------------- GitHub
// Repos live ONLY in the Repos tab (product decision), so category is fixed.
async function fetchGithub(src: SourceRow): Promise<NormalizedArticle[]> {
  const since = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
  const res = await fetch(
    `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=25`,
    { headers: { Accept: 'application/vnd.github.v3+json', ...UA }, signal: AbortSignal.timeout(10000) },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const json = await res.json() as { items: any[] };

  return json.items.filter((r) => r.description).map((r) => {
    const stars = r.stargazers_count >= 1000
      ? `${(r.stargazers_count / 1000).toFixed(1)}k ⭐`
      : `${r.stargazers_count} ⭐`;
    return base(src, {
      external_id: String(r.id),
      url: r.html_url,
      title: r.full_name,
      raw_summary: `${stars}  ·  ${String(r.description).trim()}`,
      author: r.owner?.login ?? null,
      tags: [r.language?.toLowerCase(), ...(r.topics ?? []).slice(0, 3)].filter(Boolean),
      category: 'Repos',
      published_at: toIso(r.pushed_at ?? r.created_at),
      points: r.stargazers_count ?? null,
    });
  });
}

// ------------------------------------------------------------------ Guardian
// The Guardian Open Platform: free API key (open-platform.theguardian.com).
// No-op until GUARDIAN_API_KEY is set as a function secret.
const GUARDIAN_QUERIES = [
  'section=technology',
  'q=robot%20OR%20robotics%20OR%20humanoid%20OR%20drone&section=technology|science|business',
];

async function fetchGuardian(src: SourceRow): Promise<NormalizedArticle[]> {
  const key = Deno.env.get('GUARDIAN_API_KEY');
  if (!key) return []; // no key yet — poll succeeds with nothing, no error noise

  const out: NormalizedArticle[] = [];
  for (const q of GUARDIAN_QUERIES) {
    const res = await fetch(
      `https://content.guardianapis.com/search?${q}&show-fields=trailText,thumbnail,byline&order-by=newest&page-size=20&api-key=${key}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) continue;
    const data = await res.json() as { response?: { results?: any[] } };
    for (const r of data.response?.results ?? []) {
      if (!r.webTitle || !r.webUrl) continue;
      out.push(base(src, {
        external_id: String(r.id),
        url: r.webUrl,
        title: r.webTitle,
        raw_summary: r.fields?.trailText ? stripHtml(r.fields.trailText).slice(0, 220) : null,
        author: r.fields?.byline ?? 'The Guardian',
        tags: [r.sectionName ?? 'technology'],
        published_at: toIso(r.webPublicationDate),
        image_url: r.fields?.thumbnail ?? null,
      }));
    }
  }
  return out;
}

// --------------------------------------------------------------------- main
Deno.serve(async (req) => {
  const authError = checkCronSecret(req);
  if (authError) return authError;

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: sources, error } = await sb
    .from('sources')
    .select('id, kind, name, short_name, feed_url, etag, last_modified, last_polled_at, poll_interval_minutes, consecutive_errors')
    .eq('enabled', true);
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Due = never polled, or past its interval (backed off while erroring).
  const now = Date.now();
  const due = (sources as SourceRow[])
    .filter((s) => {
      if (!s.last_polled_at) return true;
      const backoff = 1 + Math.min(s.consecutive_errors, 8);
      const intervalMs = s.poll_interval_minutes * 60_000 * backoff;
      return now - new Date(s.last_polled_at).getTime() >= intervalMs;
    })
    .slice(0, MAX_SOURCES_PER_RUN);

  const summary: Record<string, { found: number; inserted: number; error?: string }> = {};

  await Promise.allSettled(due.map(async (src) => {
    const started = Date.now();
    let found = 0;
    let inserted = 0;
    let runError: string | null = null;
    let etag: string | undefined;
    let lastModified: string | undefined;

    try {
      let articles: NormalizedArticle[] = [];
      if (src.kind === 'rss') {
        const r = await fetchRss(src);
        articles = r.articles;
        etag = r.etag;
        lastModified = r.lastModified;
      } else if (src.kind === 'hn') articles = await fetchHn(src);
      else if (src.kind === 'reddit') articles = await fetchReddit(src);
      else if (src.kind === 'devto') articles = await fetchDevto(src);
      else if (src.kind === 'lobsters') articles = await fetchLobsters(src);
      else if (src.kind === 'github') articles = await fetchGithub(src);
      else if (src.kind === 'guardian') articles = await fetchGuardian(src);

      found = articles.length;
      if (articles.length > 0) {
        const { data, error: rpcError } = await sb.rpc('ingest_upsert_articles', { p: articles });
        if (rpcError) throw new Error(`upsert: ${rpcError.message}`);
        inserted = data?.[0]?.inserted ?? 0;
      }
    } catch (e) {
      runError = String(e instanceof Error ? e.message : e).slice(0, 500);
    }

    await sb.from('sources').update({
      last_polled_at: new Date().toISOString(),
      ...(runError
        ? { consecutive_errors: src.consecutive_errors + 1, last_error: runError }
        : {
            last_success_at: new Date().toISOString(),
            consecutive_errors: 0,
            last_error: null,
            ...(etag ? { etag } : {}),
            ...(lastModified ? { last_modified: lastModified } : {}),
          }),
    }).eq('id', src.id);

    await sb.from('ingest_log').insert({
      source_id: src.id,
      found,
      inserted,
      duration_ms: Date.now() - started,
      error: runError,
    });

    summary[src.name] = { found, inserted, ...(runError ? { error: runError } : {}) };
  }));

  return new Response(JSON.stringify({ polled: due.length, summary }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
