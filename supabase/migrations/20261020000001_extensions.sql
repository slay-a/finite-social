-- Extensions needed by the ingestion pipeline.
-- pg_cron + pg_net live in the `extensions`/`pg_catalog` schemas on hosted Supabase.
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;
