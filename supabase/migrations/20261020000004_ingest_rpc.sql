-- Atomic batch upsert used by the ingest-feeds edge function (service role only).
-- Handles both unique constraints (url_hash, (source_id, external_id)) via
-- ON CONFLICT DO NOTHING, then marks cross-source duplicates by title key.

create or replace function public.ingest_upsert_articles(p jsonb)
returns table (inserted int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_ids uuid[];
begin
  with incoming as (
    select *
    from jsonb_to_recordset(p) as x(
      source_id        uuid,
      source_kind      text,
      source_name      text,
      external_id      text,
      url              text,
      title            text,
      title_dedupe_key text,
      raw_summary      text,
      author           text,
      tags             text[],
      category         text,
      published_at     timestamptz,
      points           int,
      comment_count    int,
      image_url        text
    )
  ), ins as (
    insert into public.articles (
      source_id, source_kind, source_name, external_id, url, title,
      title_dedupe_key, raw_summary, author, tags, category, published_at,
      points, comment_count, image_url
    )
    select
      source_id, source_kind, source_name, external_id, url, title,
      title_dedupe_key, raw_summary, author, coalesce(tags, '{}'), category,
      published_at, points, comment_count, image_url
    from incoming
    where url is not null and title is not null and external_id is not null
    on conflict do nothing
    returning id
  )
  select array_agg(id) into new_ids from ins;

  if new_ids is not null then
    -- Cross-source dedupe: a new row whose title key matches an older canonical
    -- article from the last 72h is hidden from the feed and linked to it.
    update public.articles a
    set is_canonical = false,
        duplicate_of = dup.keep_id
    from (
      select distinct on (a2.id) a2.id as dup_id, b.id as keep_id
      from public.articles a2
      join public.articles b
        on b.title_dedupe_key = a2.title_dedupe_key
       and b.id <> a2.id
       and b.is_canonical
       and b.created_at <= a2.created_at
       and b.published_at > now() - interval '72 hours'
      where a2.id = any(new_ids)
        and a2.title_dedupe_key <> ''
      order by a2.id, b.created_at asc
    ) dup
    where a.id = dup.dup_id;
  end if;

  return query select coalesce(array_length(new_ids, 1), 0);
end;
$$;

revoke all on function public.ingest_upsert_articles(jsonb) from public, anon, authenticated;
