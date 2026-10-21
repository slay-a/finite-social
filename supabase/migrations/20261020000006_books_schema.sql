-- Phase 3: textbook upload -> topic tree -> lazily generated scrollable cards.

create table public.books (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title            text not null,
  author           text,
  file_path        text,              -- storage path: {owner_id}/{book_id}.pdf
  file_type        text not null default 'pdf' check (file_type in ('pdf')),
  file_size_bytes  bigint,
  page_count       int,
  status           text not null default 'uploaded'
                     check (status in ('uploaded','parsing','outlined','failed')),
  parse_progress   int not null default 0,  -- pages extracted so far
  parse_error      text,
  created_at       timestamptz not null default now()
);

alter table public.books enable row level security;
create policy "owners read their books"   on public.books for select using (owner_id = auth.uid());
create policy "owners insert their books" on public.books for insert with check (owner_id = auth.uid());
create policy "owners update their books" on public.books for update using (owner_id = auth.uid());
create policy "owners delete their books" on public.books for delete using (owner_id = auth.uid());

-- Raw page text: working table for the chunked parser. Never leaves the
-- server — deny-all RLS, read only by edge functions (service role).
create table public.book_pages (
  book_id  uuid not null references public.books(id) on delete cascade,
  page_no  int not null,
  owner_id uuid not null,
  text     text not null default '',
  primary key (book_id, page_no)
);

alter table public.book_pages enable row level security;
-- deny-all: no policies

-- Topic tree detected from the book's outline/headings.
create table public.book_sections (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  owner_id    uuid not null,
  parent_id   uuid references public.book_sections(id) on delete cascade,
  depth       int not null default 0,
  order_index int not null default 0,
  label       text,          -- "3.2"
  title       text not null,
  page_start  int not null,
  page_end    int not null,
  card_status text not null default 'none'
                check (card_status in ('none','generating','ready','failed')),
  created_at  timestamptz not null default now()
);

create index book_sections_book_idx on public.book_sections (book_id, depth, order_index);

alter table public.book_sections enable row level security;
create policy "owners read their sections"   on public.book_sections for select using (owner_id = auth.uid());
create policy "owners delete their sections" on public.book_sections for delete using (owner_id = auth.uid());
-- inserts/updates via service role only

-- The generated scrollable cards, cached forever per section.
create table public.section_cards (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.book_sections(id) on delete cascade,
  owner_id    uuid not null,
  order_index int not null default 0,
  title       text not null,
  body        text not null,   -- markdown-ish
  model       text,
  created_at  timestamptz not null default now()
);

create index section_cards_section_idx on public.section_cards (section_id, order_index);

alter table public.section_cards enable row level security;
create policy "owners read their cards"   on public.section_cards for select using (owner_id = auth.uid());
create policy "owners delete their cards" on public.section_cards for delete using (owner_id = auth.uid());

-- Reading position per section. Low-trust data, so the client writes directly.
create table public.reading_progress (
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  section_id      uuid not null references public.book_sections(id) on delete cascade,
  last_card_index int not null default 0,
  completed       boolean not null default false,
  updated_at      timestamptz not null default now(),
  primary key (owner_id, section_id)
);

alter table public.reading_progress enable row level security;
create policy "owners read their progress"   on public.reading_progress for select using (owner_id = auth.uid());
create policy "owners write their progress"  on public.reading_progress for insert with check (owner_id = auth.uid());
create policy "owners update their progress" on public.reading_progress for update using (owner_id = auth.uid());
create policy "owners delete their progress" on public.reading_progress for delete using (owner_id = auth.uid());
