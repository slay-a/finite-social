-- Private cache bucket for Listen-mode narration clips (mp3, 10MB cap).
-- Only the service role writes/reads it; clients get short-lived signed URLs
-- from the tts edge function, so no storage policies are needed.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tts', 'tts', false, 10485760, '{audio/mpeg}')
on conflict (id) do nothing;
