-- 2025-11-06_init_cleanup.sql
-- Backend initialization & cleanup for 58K search seed architecture (Europe/Budapest)
-- Execute in Supabase SQL editor IN ORDER. Timezone localized via timezone('Europe/Budapest', now()).

BEGIN; -- Phase 1: Truncate legacy data tables
  TRUNCATE TABLE playlists_raw RESTART IDENTITY CASCADE;
  TRUNCATE TABLE playlists RESTART IDENTITY CASCADE;
  TRUNCATE TABLE tracks RESTART IDENTITY CASCADE;
  TRUNCATE TABLE statistics RESTART IDENTITY CASCADE;
  TRUNCATE TABLE cache RESTART IDENTITY CASCADE;
  TRUNCATE TABLE search_cache RESTART IDENTITY CASCADE;
COMMIT;

-- Phase 2: Verify critical tables exist (job_state, job_cursor, api_usage)
BEGIN;
  CREATE TABLE IF NOT EXISTS job_state (
    key text PRIMARY KEY,
    value jsonb,
    updated_at timestamptz DEFAULT timezone('Europe/Budapest', now())
  );
  CREATE TABLE IF NOT EXISTS job_cursor (
    job_name text PRIMARY KEY,
    cursor jsonb,
    updated_at timestamptz DEFAULT timezone('Europe/Budapest', now())
  );
  CREATE TABLE IF NOT EXISTS api_usage (
    id bigserial PRIMARY KEY,
    ts timestamptz DEFAULT timezone('Europe/Budapest', now()),
    api_key_hash text,
    endpoint text,
    quota_cost int,
    status text,
    error_code text,
    error_message text
  );
COMMIT;

-- Phase 3: RLS Policies (service_role full access, anon restricted)
BEGIN;
  ALTER TABLE job_state ENABLE ROW LEVEL SECURITY;
  ALTER TABLE job_cursor ENABLE ROW LEVEL SECURITY;
  ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

  -- Drop existing policies (idempotent)
  DO $$ BEGIN
    PERFORM 1 FROM pg_policies WHERE tablename = 'job_state' AND policyname = 'service_role_all';
    IF FOUND THEN EXECUTE 'DROP POLICY service_role_all ON job_state'; END IF;
  END $$;
  DO $$ BEGIN
    PERFORM 1 FROM pg_policies WHERE tablename = 'job_cursor' AND policyname = 'service_role_all';
    IF FOUND THEN EXECUTE 'DROP POLICY service_role_all ON job_cursor'; END IF;
  END $$;
  DO $$ BEGIN
    PERFORM 1 FROM pg_policies WHERE tablename = 'api_usage' AND policyname = 'service_role_all';
    IF FOUND THEN EXECUTE 'DROP POLICY service_role_all ON api_usage'; END IF;
  END $$;

  CREATE POLICY service_role_all ON job_state FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_all ON job_cursor FOR ALL TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY service_role_all ON api_usage FOR ALL TO service_role USING (true) WITH CHECK (true);
COMMIT;

-- Phase 4: Seed architecture tables (search_seeds already created via migration)
-- Ensure search_seeds present
BEGIN;
  CREATE TABLE IF NOT EXISTS public.search_seeds (
    id BIGSERIAL PRIMARY KEY,
    day INT NOT NULL CHECK (day BETWEEN 1 AND 29),
    slot INT NOT NULL CHECK (slot BETWEEN 0 AND 19),
    pos INT NOT NULL CHECK (pos BETWEEN 0 AND 99),
    query TEXT NOT NULL UNIQUE,
    tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('Europe/Budapest', now())
  );
COMMIT;

-- Phase 5: Grant minimal privileges (adjust if using Supabase predefined roles)
BEGIN;
  GRANT SELECT ON public.search_seeds TO anon;
  GRANT SELECT, INSERT, UPDATE, DELETE ON job_state TO service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON job_cursor TO service_role;
  GRANT SELECT, INSERT ON api_usage TO service_role;
COMMIT;

-- Phase 6: Final verification query examples (optional)
-- SELECT count(*) FROM public.search_seeds;
-- SELECT * FROM api_usage ORDER BY ts DESC LIMIT 10;

-- ✅ Completed initialization & cleanup (Europe/Budapest timezone)
