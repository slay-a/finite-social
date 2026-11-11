-- Watch-mode reel screenplay per section: typed scenes (title/points/diagram/
-- stat/quote/figure) with purpose-written narration, generated once by the
-- generate-reel edge function and replayed from here ever after.
alter table public.book_sections add column if not exists reel_script jsonb;
alter table public.book_sections add column if not exists reel_status text;
