-- Event-date tracking for freshness display, book card modes, and card visuals.

alter table public.articles add column ai_event_date date;

alter table public.books add column card_mode text not null default 'concise'
  check (card_mode in ('concise', 'detailed'));

alter table public.section_cards add column visual jsonb;

-- Fix: github articles were excluded from extraction, so they never reached a
-- settled extract_status and the summarizer never picked them up. Let them
-- flow through extraction like everything else (robots.txt decides), and
-- unstick the existing rows.
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
    where extract_status = 'pending'
       or (extract_status = 'working' and extract_claimed_at < now() - interval '30 minutes')
    order by published_at desc
    limit batch_size
    for update skip locked
  )
  returning a.*;
$$;

update public.articles set extract_status = 'skipped'
where source_kind = 'github' and extract_status = 'pending';
