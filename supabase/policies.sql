-- RLS policies for public READ (safe patterns)

-- Enable RLS
alter table public.playlists enable row level security;
alter table public.tracks enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.users enable row level security;

-- Public read-only for playlists marked as public
create policy if not exists playlists_read_public on public.playlists
  for select
  using (is_public is true);

-- Public read for tracks that are referenced from any public playlist
-- Simple approach: allow select for all tracks (public catalog). If stricter, replace with EXISTS join.
create policy if not exists tracks_read_public on public.tracks
  for select
  using (true);

-- Public read for playlist_tracks only when parent playlist is public
create policy if not exists playlist_tracks_read_public on public.playlist_tracks
  for select
  using (
    exists (
      select 1 from public.playlists p where p.id = playlist_id and p.is_public is true
    )
  );

-- No public writes by default (do not add INSERT/UPDATE/DELETE policies)
