-- Server-side news ingestion: curated sources polled by the ingest-feeds edge
-- function, articles stored once and served to every client from Postgres.

-- ---------------------------------------------------------------------------
-- sources: the curated list the pipeline polls. `kind` picks the fetcher.
-- ---------------------------------------------------------------------------
create table public.sources (
  id                    uuid primary key default gen_random_uuid(),
  kind                  text not null check (kind in ('rss','hn','reddit','devto','lobsters','github')),
  name                  text not null unique,
  short_name            text not null,
  feed_url              text,           -- RSS feed URL; null for API kinds
  site_url              text,
  categories            text[] not null default '{}',
  enabled               boolean not null default true,
  poll_interval_minutes int not null default 15,
  etag                  text,           -- conditional GET bookkeeping (RSS)
  last_modified         text,
  last_polled_at        timestamptz,
  last_success_at       timestamptz,
  consecutive_errors    int not null default 0,
  last_error            text,
  created_at            timestamptz not null default now()
);

alter table public.sources enable row level security;

create policy "sources are readable by signed-in users"
  on public.sources for select to authenticated using (true);
-- no insert/update/delete policies: writes go through edge functions (service role)

-- ---------------------------------------------------------------------------
-- articles: one row per story. Clients read canonical rows only.
-- ---------------------------------------------------------------------------
create table public.articles (
  id                uuid primary key default gen_random_uuid(),
  source_id         uuid not null references public.sources(id) on delete cascade,
  source_kind       text not null,
  source_name       text not null,
  external_id       text not null,     -- HN objectID / reddit id / RSS guid or link
  url               text not null,
  canonical_url     text,
  url_hash          text generated always as (md5(lower(url))) stored,
  title             text not null,
  title_dedupe_key  text not null,     -- first 50 alnum chars, lowercased (same rule as the app's feedMerger)
  is_canonical      boolean not null default true,
  duplicate_of      uuid references public.articles(id),
  raw_summary       text,
  author            text,
  tags              text[] not null default '{}',
  category          text not null default 'Dev'
                      check (category in ('AI','Dev','Startups','Security','Science','Repos')),
  published_at      timestamptz not null,
  points            int,
  comment_count     int,
  image_url         text,
  extract_status    text not null default 'pending'
                      check (extract_status in ('pending','working','done','skipped','failed','robots_blocked')),
  extract_attempts  int not null default 0,
  ai_status         text not null default 'pending'
                      check (ai_status in ('pending','working','done','failed','skipped')),
  ai_title          text,
  ai_summary        text,
  ai_model          text,
  ai_generated_at   timestamptz,
  created_at        timestamptz not null default now(),
  unique (source_id, external_id)
);

create unique index articles_url_hash_idx on public.articles (url_hash);
create index articles_published_idx on public.articles (published_at desc);
create index articles_category_feed_idx on public.articles (category, published_at desc)
  where is_canonical;
create index articles_title_dedupe_idx on public.articles (title_dedupe_key, published_at desc);
create index articles_extract_pending_idx on public.articles (published_at desc)
  where extract_status = 'pending';
create index articles_ai_pending_idx on public.articles (published_at desc)
  where ai_status = 'pending';

alter table public.articles enable row level security;

create policy "canonical articles are readable by signed-in users"
  on public.articles for select to authenticated using (is_canonical);
-- no client writes

-- ---------------------------------------------------------------------------
-- ingest_log: per-source run bookkeeping for debugging. Service role only.
-- ---------------------------------------------------------------------------
create table public.ingest_log (
  id          bigint generated always as identity primary key,
  source_id   uuid references public.sources(id) on delete cascade,
  run_at      timestamptz not null default now(),
  found       int not null default 0,
  inserted    int not null default 0,
  duration_ms int,
  error       text
);

alter table public.ingest_log enable row level security;
-- deny-all: no policies

-- ---------------------------------------------------------------------------
-- Seed the curated source list (mirrors the client-side fetchers).
-- ---------------------------------------------------------------------------
insert into public.sources (kind, name, short_name, feed_url, site_url, categories) values
  ('rss', 'TechCrunch',      'TC',    'https://techcrunch.com/feed/',                    'https://techcrunch.com',          '{All,AI,Startups}'),
  ('rss', 'The Verge',       'VERGE', 'https://www.theverge.com/rss/index.xml',          'https://www.theverge.com',        '{All,AI,Science}'),
  ('rss', 'Wired',           'WIRED', 'https://www.wired.com/feed/rss',                  'https://www.wired.com',           '{All,AI,Security,Science}'),
  ('rss', 'Ars Technica',    'ARS',   'https://feeds.arstechnica.com/arstechnica/index', 'https://arstechnica.com',         '{All,Dev,Security,Science}'),
  ('rss', 'MIT Tech Review', 'MIT',   'https://www.technologyreview.com/feed/',          'https://www.technologyreview.com','{All,AI,Science}'),
  ('rss', 'Product Hunt',    'PH',    'https://www.producthunt.com/feed',                'https://www.producthunt.com',     '{All,Startups,Dev}'),
  ('rss', 'VentureBeat',     'VB',    'https://venturebeat.com/feed/',                   'https://venturebeat.com',         '{All,AI,Startups}'),
  ('rss', 'The Register',    'REG',   'https://www.theregister.com/headlines.atom',      'https://www.theregister.com',     '{All,Dev,Security}'),
  ('rss', 'ZDNet',           'ZDN',   'https://www.zdnet.com/news/rss.xml',              'https://www.zdnet.com',           '{All,Dev,Security}'),
  ('rss', 'InfoQ',           'IQ',    'https://feed.infoq.com/',                         'https://www.infoq.com',           '{All,Dev,AI}'),
  ('hn',       'Hacker News', 'HN',     null, 'https://news.ycombinator.com', '{All,AI,Dev,Startups,Security,Science}'),
  ('reddit',   'Reddit',      'REDDIT', null, 'https://www.reddit.com',       '{All,AI,Dev,Startups,Security,Science}'),
  ('devto',    'DEV',         'DEV',    null, 'https://dev.to',               '{All,AI,Dev,Startups,Security,Science}'),
  ('lobsters', 'Lobsters',    'LOB',    null, 'https://lobste.rs',            '{All,AI,Dev,Security,Science}'),
  ('github',   'GitHub',      'GH',     null, 'https://github.com',           '{All,Dev,Repos}');
