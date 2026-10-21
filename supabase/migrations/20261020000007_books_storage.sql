-- Private bucket for uploaded books: 50MB cap, PDFs only, per-user folders.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 52428800, '{application/pdf}')
on conflict (id) do nothing;

create policy "users upload into their own books folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users read their own books"
  on storage.objects for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users delete their own books"
  on storage.objects for delete to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = auth.uid()::text);
