-- backend/src/lib/models/seenCache.sql
-- 24h seen-cache for playlist external_ids to avoid repeat validations within a day

CREATE TABLE IF NOT EXISTS public.seen_cache (
  external_id TEXT PRIMARY KEY,
  seen_on TIMESTAMPTZ DEFAULT NOW()
);

-- Optional cleanup (run via a scheduled job if desired):
-- DELETE FROM public.seen_cache WHERE seen_on < NOW() - INTERVAL '1 day';
