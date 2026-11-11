-- Document type from the upload topic gate (textbook, academic_paper, ...).
alter table public.books add column if not exists doc_type text;
