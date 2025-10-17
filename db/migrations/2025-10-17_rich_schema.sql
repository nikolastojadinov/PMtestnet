-- Rich schema migration for Purple Music (playlists/tracks/playlist_tracks)
-- Safe: uses IF NOT EXISTS for additive columns; no destructive changes.

-- playlists table enrichments
ALTER TABLE IF EXISTS public.playlists
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS item_count integer,
  ADD COLUMN IF NOT EXISTS channel_title text,
  ADD COLUMN IF NOT EXISTS fetched_on timestamptz,
  ADD COLUMN IF NOT EXISTS view_count bigint,
  ADD COLUMN IF NOT EXISTS channel_subscriber_count bigint,
  ADD COLUMN IF NOT EXISTS last_etag text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- tracks table enrichments
ALTER TABLE IF EXISTS public.tracks
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS artist text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- playlist_tracks table enrichments
ALTER TABLE IF EXISTS public.playlist_tracks
  ADD COLUMN IF NOT EXISTS position integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Helpful indexes (idempotent with IF NOT EXISTS in Postgres 15+ is limited; use DO blocks)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_playlists_updated_at ON public.playlists(updated_at);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_tracks_updated_at ON public.tracks(updated_at);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON public.playlist_tracks(playlist_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON public.playlist_tracks(track_id);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
