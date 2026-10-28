-- Cards v2: quiz cards, figure cards (the book's own images), and richer
-- visual types; plus figure bookkeeping for extraction during parsing.

alter table public.section_cards
  add column kind text not null default 'content'
    check (kind in ('content', 'quiz', 'figure')),
  add column quiz jsonb,
  add column figure jsonb;

-- Images extracted from the uploaded PDF (stored in the books bucket under
-- {owner}/{book}/figures/...). The author's own figures: zero hallucination.
create table public.book_figures (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references public.books(id) on delete cascade,
  owner_id     uuid not null,
  page_no      int not null,
  idx          int not null default 0,
  storage_path text not null,
  width        int,
  height       int,
  created_at   timestamptz not null default now(),
  unique (book_id, page_no, idx)
);

-- The bucket now also stores extracted figure PNGs.
update storage.buckets
set allowed_mime_types = '{application/pdf,image/png}'
where id = 'books';

alter table public.book_figures enable row level security;
create policy "owners read their figures" on public.book_figures
  for select using (owner_id = auth.uid());
-- writes via service role only
