-- Phase 2: server-side article extraction + AI summaries.

-- Private extracted full text. Separate deny-all table (not a column on
-- articles) so the feed stays light and the text is service-role only:
-- we store it for summarization, we never republish it.
create table public.article_contents (
  article_id     uuid primary key references public.articles(id) on delete cascade,
  extracted_text text not null,
  word_count     int,
  extracted_at   timestamptz not null default now()
);

alter table public.article_contents enable row level security;
-- deny-all: no policies

-- Claim timestamps so stuck 'working' rows recover after 30 minutes.
alter table public.articles
  add column extract_claimed_at timestamptz,
  add column ai_claimed_at      timestamptz;

-- ---------------------------------------------------------------------------
-- Claim RPCs (service role only): FOR UPDATE SKIP LOCKED batches so
-- overlapping cron runs never double-work a row.
-- ---------------------------------------------------------------------------
create or replace function public.claim_extract_batch(batch_size int)
returns setof public.articles
language sql
security definer
set search_path = ''
as $$
  update public.articles a
  set extract_status = 'working', extract_claimed_at = now()
  where a.id in (
    select id from public.articles
    where source_kind <> 'github'
      and (
        extract_status = 'pending'
        or (extract_status = 'working' and extract_claimed_at < now() - interval '30 minutes')
      )
    order by published_at desc
    limit batch_size
    for update skip locked
  )
  returning a.*;
$$;

create or replace function public.claim_summarize_batch(batch_size int)
returns setof public.articles
language sql
security definer
set search_path = ''
as $$
  update public.articles a
  set ai_status = 'working', ai_claimed_at = now()
  where a.id in (
    select id from public.articles
    where extract_status in ('done','failed','skipped','robots_blocked')
      and (
        ai_status = 'pending'
        or (ai_status = 'working' and ai_claimed_at < now() - interval '30 minutes')
      )
    order by published_at desc
    limit batch_size
    for update skip locked
  )
  returning a.*;
$$;

revoke all on function public.claim_extract_batch(int) from public, anon, authenticated;
revoke all on function public.claim_summarize_batch(int) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cron: extraction and summarization every 5 minutes (offset), cleanup nightly.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'extract-articles',
  '*/5 * * * *',
  $$ select public.call_edge_function('extract-articles') $$
);

select cron.schedule(
  'summarize-articles',
  '2-59/5 * * * *',
  $$ select public.call_edge_function('summarize-articles') $$
);

-- Retention: extracted text 30d, logs 14d, articles 90d.
select cron.schedule(
  'feed-cleanup',
  '30 3 * * *',
  $$
    delete from public.article_contents where extracted_at < now() - interval '30 days';
    delete from public.ingest_log where run_at < now() - interval '14 days';
    delete from public.articles where published_at < now() - interval '90 days';
  $$
);
