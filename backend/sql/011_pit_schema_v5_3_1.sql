-- =====================================================
-- 🟣 Purple Music — PIT DATABASE SCHEMA v5.3.1 (Error-safe)
-- =====================================================

-- 🧹 0️⃣ AUTO-CLEAN CONFLICTING VIEWS
DO $$
DECLARE
  v RECORD;
BEGIN
  FOR v IN (SELECT table_schema, table_name
            FROM information_schema.views
            WHERE table_schema = 'public'
              AND table_name LIKE 'v_playlists%')
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS %I.%I CASCADE', v.table_schema, v.table_name);
  END LOOP;
END $$;


-- =====================================================
-- 1️⃣ USERS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet text UNIQUE NOT NULL,
  user_consent boolean DEFAULT false,
  premium_until timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  spotify_connected boolean DEFAULT false,
  spotify_expires_at timestamp with time zone,
  country text,
  language text
);


-- =====================================================
-- 2️⃣ TRACKS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.tracks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text DEFAULT 'youtube' NOT NULL,
  external_id text UNIQUE NOT NULL,
  title text NOT NULL,
  artist text,
  duration integer,
  cover_url text,
  created_at timestamp with time zone DEFAULT now(),
  sync_status text,
  last_synced_at timestamp with time zone,
  fetched_on timestamp with time zone,
  language_guess text,
  genre text
);

CREATE INDEX IF NOT EXISTS tracks_source_idx ON public.tracks (source);
CREATE INDEX IF NOT EXISTS tracks_created_idx ON public.tracks (created_at);


-- =====================================================
-- 3️⃣ PLAYLISTS
-- =====================================================
ALTER TABLE IF EXISTS public.playlists
  DROP COLUMN IF EXISTS itemcount,
  DROP COLUMN IF EXISTS is_duplicate_of,
  DROP COLUMN IF EXISTS unstable,
  DROP COLUMN IF EXISTS broken;

ALTER TABLE IF EXISTS public.playlists
  ADD COLUMN IF NOT EXISTS validated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_on timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_refreshed_on timestamp with time zone,
  ADD COLUMN IF NOT EXISTS fetched_on timestamp with time zone,
  ADD COLUMN IF NOT EXISTS cycle_mode text,
  ADD COLUMN IF NOT EXISTS cycle_day smallint,
  ADD COLUMN IF NOT EXISTS fetched_cycle_day integer,
  ADD COLUMN IF NOT EXISTS quality_score numeric,
  ADD COLUMN IF NOT EXISTS tier text,
  ADD COLUMN IF NOT EXISTS keyword_used text,
  ADD COLUMN IF NOT EXISTS sync_status text,
  ADD COLUMN IF NOT EXISTS last_etag text,
  ADD COLUMN IF NOT EXISTS language_guess text,
  ADD COLUMN IF NOT EXISTS genre text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS is_empty boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS item_count integer,
  ADD COLUMN IF NOT EXISTS channel_id text,
  ADD COLUMN IF NOT EXISTS channel_title text,
  ADD COLUMN IF NOT EXISTS channel_subscriber_count bigint,
  ADD COLUMN IF NOT EXISTS view_count bigint,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS title text NOT NULL,
  ADD COLUMN IF NOT EXISTS description text;

-- 🧩 Ako tabela već ima primarni ključ, ne pokušavaj dodati novi
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.playlists'::regclass
      AND contype = 'p'
  ) THEN
    EXECUTE 'ALTER TABLE public.playlists ADD CONSTRAINT playlists_pkey PRIMARY KEY (id);';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS playlists_external_id_idx
  ON public.playlists (external_id);
CREATE INDEX IF NOT EXISTS playlists_region_idx ON public.playlists (region);
CREATE INDEX IF NOT EXISTS playlists_category_idx ON public.playlists (category);
CREATE INDEX IF NOT EXISTS playlists_cycle_mode_idx ON public.playlists (cycle_mode);


-- =====================================================
-- 4️⃣ LIKES
-- =====================================================
CREATE TABLE IF NOT EXISTS public.likes (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  liked_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);


-- =====================================================
-- 5️⃣ PLAYLIST_TRACKS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.playlist_tracks (
  playlist_id uuid REFERENCES public.playlists(id) ON DELETE CASCADE,
  track_id uuid REFERENCES public.tracks(id) ON DELETE CASCADE,
  added_at timestamp with time zone DEFAULT now(),
  position integer,
  PRIMARY KEY (playlist_id, track_id)
);


-- =====================================================
-- 6️⃣ STATISTICS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.statistics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  action text,
  track_id uuid REFERENCES public.tracks(id),
  created_at timestamp with time zone DEFAULT now(),
  session_id text,
  device text,
  duration integer
);

CREATE INDEX IF NOT EXISTS statistics_user_idx ON public.statistics (user_id);
CREATE INDEX IF NOT EXISTS statistics_track_idx ON public.statistics (track_id);


-- =====================================================
-- 7️⃣ CACHE & SEARCH_CACHE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cache (
  key text PRIMARY KEY,
  value jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.search_cache (
  query text PRIMARY KEY,
  results jsonb,
  created_at timestamp with time zone DEFAULT now()
);


-- =====================================================
-- 8️⃣ VIEWS (recreated clean)
-- =====================================================
CREATE OR REPLACE VIEW public.v_playlists_full AS
SELECT
  p.id,
  p.title,
  p.description,
  p.cover_url,
  p.region,
  p.category,
  p.is_public,
  p.item_count,
  p.channel_title,
  p.channel_id,
  p.channel_subscriber_count,
  p.view_count,
  p.quality_score,
  p.tier,
  p.cycle_mode,
  p.language_guess,
  p.genre,
  p.country,
  p.external_id,
  p.last_refreshed_on,
  p.fetched_on,
  p.validated_on,
  COUNT(pt.track_id) AS track_total
FROM public.playlists p
LEFT JOIN public.playlist_tracks pt ON pt.playlist_id = p.id
GROUP BY p.id;

CREATE OR REPLACE VIEW public.v_playlists_public AS
SELECT
  id,
  title,
  description,
  cover_url,
  region,
  category,
  is_public,
  item_count,
  channel_title,
  channel_id,
  channel_subscriber_count,
  view_count,
  quality_score,
  tier,
  cycle_mode,
  language_guess,
  genre,
  country,
  external_id,
  last_refreshed_on,
  fetched_on,
  validated_on
FROM public.playlists
WHERE is_public = true;


-- =====================================================
-- 9️⃣ SANITY CHECKS
-- =====================================================
UPDATE public.playlists
  SET cycle_mode = COALESCE(cycle_mode, 'FETCH')
WHERE cycle_mode IS NULL;

UPDATE public.playlists
  SET is_public = COALESCE(is_public, true);

ANALYZE public.playlists;
ANALYZE public.tracks;
ANALYZE public.playlist_tracks;

-- =====================================================
-- ✅ END OF Purple Music PIT DATABASE SCHEMA v5.3.1
-- =====================================================
