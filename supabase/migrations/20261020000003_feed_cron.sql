-- Schedule the ingestion pipeline with pg_cron -> pg_net -> edge functions.
--
-- Before this migration is applied in an environment, create two Vault secrets
-- (Dashboard > Project Settings > Vault, or select vault.create_secret(...)):
--   project_url  = https://<project-ref>.supabase.co
--   cron_secret  = <long random string>
-- and set the same value as an edge-function secret:
--   supabase secrets set CRON_SECRET=<same random string>
--
-- Cron-triggered functions are deployed with --no-verify-jwt (the gateway 401s
-- ES256 JWTs; see README) and authenticate via the x-cron-secret header instead.

create or replace function public.call_edge_function(func_name text)
returns void
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
             || '/functions/v1/' || func_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$$;

revoke all on function public.call_edge_function(text) from public, anon, authenticated;

select cron.schedule(
  'ingest-feeds',
  '*/15 * * * *',
  $$ select public.call_edge_function('ingest-feeds') $$
);
