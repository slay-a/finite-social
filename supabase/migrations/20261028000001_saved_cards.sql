-- Save individual study cards for later review.
create table public.saved_cards (
  owner_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id    uuid not null references public.section_cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, card_id)
);

alter table public.saved_cards enable row level security;
create policy "owners read their saved cards"   on public.saved_cards for select using (owner_id = auth.uid());
create policy "owners save cards"               on public.saved_cards for insert with check (owner_id = auth.uid());
create policy "owners unsave cards"             on public.saved_cards for delete using (owner_id = auth.uid());
