# Deploying the ingestion backend + books feature

One-time setup, in order. Everything targets the existing Supabase project
`thcvuehyblejxetazvia` (finite-social).

## 0. Prereqs
- `supabase login` with the account that owns the finite-social project
  (the CLI on this machine is currently logged into a different account).
- `supabase link --project-ref thcvuehyblejxetazvia` (asks for the DB password).

## 1. Secrets
```bash
# a long random string shared between pg_cron and the cron-triggered functions
CRON=$(openssl rand -hex 32)

supabase secrets set CRON_SECRET=$CRON
supabase secrets set OPENAI_API_KEY=sk-...   # already set if ai-chat works
```
Then create the two Vault secrets (Dashboard → Project Settings → Vault, or SQL editor):
```sql
select vault.create_secret('https://thcvuehyblejxetazvia.supabase.co', 'project_url');
select vault.create_secret('<the same CRON value>', 'cron_secret');
```
Create the Vault secrets BEFORE pushing migrations — the cron migration reads them.

## 2. Database
```bash
supabase db dump -f backup-$(date +%F).sql   # safety first
supabase db push                              # applies supabase/migrations/*
```

## 3. Edge functions
All deploy with --no-verify-jwt (gateway 401s ES256 JWTs; auth is checked
in-function: cron secret or user JWT):
```bash
supabase functions deploy ingest-feeds --no-verify-jwt
supabase functions deploy extract-articles --no-verify-jwt
supabase functions deploy summarize-articles --no-verify-jwt
supabase functions deploy process-book --no-verify-jwt
supabase functions deploy generate-section-cards --no-verify-jwt
```

## 4. Smoke test
```bash
# ingest once manually; expect per-source found/inserted JSON
curl -s -X POST https://thcvuehyblejxetazvia.supabase.co/functions/v1/ingest-feeds \
  -H "x-cron-secret: $CRON" | head -c 2000

# run again: inserted should be ~0 (dedupe + etag working)
```
Then in the SQL editor:
```sql
select source_name, count(*) from articles group by 1 order by 2 desc;
select * from cron.job_run_details order by start_time desc limit 10;  -- after 15 min
select extract_status, ai_status, count(*) from articles group by 1, 2; -- after ~10 min
```

## 5. App
No config needed — the app reads `articles` via the anon key + RLS and falls
back to on-device fetching while the table is empty.

## Books feature test
Upload a PDF from the Learn tab. First visit to a section takes a few seconds
(cards are generated on demand, then cached forever). A scanned PDF with no
text layer fails with a clear message — that's expected for now.

## Costs at steady state
~700 edge invocations/day (free tier: 500k/mo), DB ~80MB with retention,
OpenAI ≈ $3–4/month for ~300 articles/day + ~$0.06 per uploaded book.
