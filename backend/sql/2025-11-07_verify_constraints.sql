BEGIN;
ALTER TABLE public.tracks ADD CONSTRAINT IF NOT EXISTS tracks_external_id_key UNIQUE (external_id);
ALTER TABLE public.playlist_tracks ADD CONSTRAINT IF NOT EXISTS playlist_tracks_unique UNIQUE (playlist_id, track_id);
COMMIT;
