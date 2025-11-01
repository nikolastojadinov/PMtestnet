-- Supabase schema for Purple Music (minimal, safe to run)
-- Creates core tables used by the frontend: playlists, tracks, playlist_tracks, users
-- Idempotent-friendly (uses IF NOT EXISTS where supported)

-- Enable extensions used by typical projects (safe if already exists)
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- USERS
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  pi_uid text unique,
  username text,
  wallet text,
  user_consent boolean default false,
  premium_until timestamptz,
  created_at timestamptz default now(),
  country text default 'GLOBAL',
  language text default 'en'
);

-- PLAYLISTS
create table if not exists public.playlists (
  id uuid primary key default uuid_generate_v4(),
  external_id text unique,
  title text not null,
  description text,
  is_public boolean default true,
  created_at timestamptz default now(),
  cover_url text,
  region text default 'GLOBAL',
  category text,
  item_count integer,
  fetched_on timestamptz,
  last_refreshed_on timestamptz
);
create index if not exists idx_playlists_created_at on public.playlists (created_at desc);
create index if not exists idx_playlists_category on public.playlists (category);

-- TRACKS (YouTube-only friendly)
create table if not exists public.tracks (
  id uuid primary key default uuid_generate_v4(),
  source text check (source = any (array['youtube'])) default 'youtube',
  external_id text unique,  -- YouTube videoId
  title text not null,
  artist text,
  cover_url text,
  created_at timestamptz default now()
);
create index if not exists idx_tracks_created_at on public.tracks (created_at desc);

-- PLAYLIST_TRACKS (position preserved)
create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  position integer,
  added_at timestamptz default now(),
  primary key (playlist_id, track_id)
);
create index if not exists idx_playlist_tracks_playlist_pos on public.playlist_tracks (playlist_id, position);

-- Seed example (optional): comment/uncomment as needed
-- insert into public.playlists (title, category, cover_url) values
--   ('Top Global Hits', 'music', 'https://.../cover.jpg')
-- on conflict do nothing;
