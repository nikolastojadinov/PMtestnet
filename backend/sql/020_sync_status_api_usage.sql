-- 020_sync_status_api_usage.sql
-- Purpose: align DB with app expectations for tracks.sync_status and fix api_usage permissions
-- Safe to run multiple times; uses IF NOT EXISTS guards where possible.

-- 1) Normalize tracks.sync_status to an enum with allowed values used by the app
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'track_sync_status') THEN
    CREATE TYPE public.track_sync_status AS ENUM (
      'fetched', 'refreshed', 'ready', 'updated', 'new', 'queued', 'linked'
    );
  END IF;
END$$;

-- Drop old CHECK constraint if it exists (name from logs)
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.tracks DROP CONSTRAINT IF EXISTS tracks_sync_status_check;
  EXCEPTION WHEN undefined_object THEN
    -- ignore if it never existed
    NULL;
  END;
END$$;

-- Ensure column exists (older schemas might have it as text)
ALTER TABLE public.tracks
  ADD COLUMN IF NOT EXISTS sync_status text;

-- Convert to enum type, coalescing invalid/unknown values to 'fetched'
DO $$
BEGIN
  -- Only change type if not already the enum
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tracks'
      AND column_name = 'sync_status'
      AND data_type <> 'USER-DEFINED'
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.columns c
    LEFT JOIN pg_type t ON t.typname = 'track_sync_status'
    WHERE c.table_schema = 'public'
      AND c.table_name = 'tracks'
      AND c.column_name = 'sync_status'
      AND c.udt_name <> 'track_sync_status'
  ) THEN
    ALTER TABLE public.tracks
      ALTER COLUMN sync_status DROP DEFAULT,
      ALTER COLUMN sync_status TYPE public.track_sync_status
        USING (
          CASE
            WHEN sync_status IN ('fetched','refreshed','ready','updated','new','queued','linked')
              THEN sync_status::public.track_sync_status
            ELSE 'fetched'::public.track_sync_status
          END
        ),
      ALTER COLUMN sync_status SET DEFAULT 'fetched'::public.track_sync_status;
  ELSE
    -- If already the desired enum, just ensure default is set
    ALTER TABLE public.tracks
      ALTER COLUMN sync_status SET DEFAULT 'fetched'::public.track_sync_status;
  END IF;
END$$;

-- 2) Ensure api_usage is writeable by service role (and authenticated) without RLS
-- Create the table if missing (idempotent, matches backend/sql/001_schema.sql minimal columns)
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz DEFAULT now(),
  api_key_hash text,
  endpoint text,
  quota_cost integer,
  status text,
  error_code text,
  error_message text
);

-- Grant privileges (service_role inherits authenticated, but we grant to both for clarity)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT INSERT, SELECT ON public.api_usage TO authenticated, service_role;

-- If you prefer RLS instead of GRANTs, uncomment below and remove the GRANTs above.
-- Note: service_role bypasses RLS, but policy below is explicit for clarity.
--
-- ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS api_usage_insert_service ON public.api_usage;
-- CREATE POLICY api_usage_insert_service ON public.api_usage
--   FOR INSERT
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');

-- ANALYZE for planner stats (no harm if not allowed)
DO $$ BEGIN
  BEGIN
    ANALYZE public.tracks;
    ANALYZE public.api_usage;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
