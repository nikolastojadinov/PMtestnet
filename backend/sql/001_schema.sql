-- Supabase schema for 29-day YouTube fetch/refresh system
-- Run in order before other scripts

-- Extensions (if not already enabled)
create extension if not exists pgcrypto;

-- SETTINGS
create table if not exists public.settings (
  key text primary key,
  value jsonb,
  updated_at timestamp with time zone default now()
);

-- RAW PLAYLIST CANDIDATES
create table if not exists public.playlists_raw (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  title text,
  description text,
  channel_id text,
  channel_title text,
  region text,
  category text,
  privacy_status text,
  item_count integer,
  thumbnail_url text,
  fetched_on timestamp with time zone default now(),
  validated boolean default false,
  invalid_reason text,
  cycle_day smallint,
  cycle_mode text,
  etag text
);
create unique index if not exists uq_playlists_raw_external_id on public.playlists_raw (external_id);
create index if not exists idx_playlists_raw_region_category on public.playlists_raw (region, category);

-- PLAYLISTS (validated)
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  title text,
  description text,
  channel_id text,
  channel_title text,
  cover_url text,
  region text,
  category text,
  is_public boolean default true,
  is_empty boolean default false,
  item_count integer,
  fetched_on timestamp with time zone,
  validated_on timestamp with time zone,
  last_refreshed_on timestamp with time zone,
  last_etag text,
  unstable boolean default false,
  quality_score numeric,
  broken boolean default false,
  cycle_day smallint,
  cycle_mode text
);
-- Harden existing installations: add missing columns if table already existed
alter table public.playlists add column if not exists external_id text;
alter table public.playlists add column if not exists cover_url text;
alter table public.playlists add column if not exists is_public boolean default true;
alter table public.playlists add column if not exists is_empty boolean default false;
alter table public.playlists add column if not exists item_count integer;
alter table public.playlists add column if not exists fetched_on timestamp with time zone;
alter table public.playlists add column if not exists validated_on timestamp with time zone;
alter table public.playlists add column if not exists last_refreshed_on timestamp with time zone;
alter table public.playlists add column if not exists last_etag text;
alter table public.playlists add column if not exists unstable boolean default false;
alter table public.playlists add column if not exists quality_score numeric;
alter table public.playlists add column if not exists broken boolean default false;
alter table public.playlists add column if not exists cycle_day smallint;
alter table public.playlists add column if not exists cycle_mode text;
create unique index if not exists uq_playlists_external_id on public.playlists (external_id);
create index if not exists idx_playlists_region_category on public.playlists (region, category);
create index if not exists idx_playlists_last_refreshed_on on public.playlists (last_refreshed_on);

-- TRACKS (dedup by external_id)
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'youtube',
  external_id text not null,
  title text,
  artist text,
  duration integer,
  cover_url text,
  region text,
  category text,
  created_at timestamp with time zone default now(),
  sync_status text,
  last_synced_at timestamp with time zone
);
-- Add missing columns if table pre-existed
alter table public.tracks add column if not exists source text not null default 'youtube';
alter table public.tracks add column if not exists external_id text;
alter table public.tracks add column if not exists title text;
alter table public.tracks add column if not exists artist text;
alter table public.tracks add column if not exists duration integer;
alter table public.tracks add column if not exists cover_url text;
alter table public.tracks add column if not exists region text;
alter table public.tracks add column if not exists category text;
alter table public.tracks add column if not exists created_at timestamp with time zone default now();
alter table public.tracks add column if not exists sync_status text;
alter table public.tracks add column if not exists last_synced_at timestamp with time zone;
create unique index if not exists uq_tracks_external_id on public.tracks (external_id);
create index if not exists idx_tracks_created_at on public.tracks (created_at);

-- PIVOT: PLAYLIST <-> TRACKS
create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id uuid not null references public.tracks(id) on delete cascade,
  added_at timestamp with time zone default now(),
  position integer,
  primary key (playlist_id, track_id)
);
create index if not exists idx_playlist_tracks_position on public.playlist_tracks (playlist_id, position);

-- OPTIONAL SOFT DELETE FOR LINKS (uncomment if needed)
-- alter table public.playlist_tracks add column if not exists removed_at timestamp with time zone;

-- CONFIG TABLES
create table if not exists public.categories (
  key text primary key,
  group_key text,
  label text not null
);
-- If categories existed without these columns, add them
alter table public.categories add column if not exists key text;
alter table public.categories add column if not exists group_key text;
alter table public.categories add column if not exists label text;
create unique index if not exists uq_categories_key on public.categories(key);

-- Backward-compatibility: some installs may have had a NOT NULL "name" column.
-- If present, relax the NOT NULL and backfill label from name so our seeds work.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'categories' and column_name = 'name'
  ) then
    begin
      execute 'alter table public.categories alter column name drop not null';
    exception when undefined_column then
      -- ignore if column disappeared between checks
      null;
    end;
    -- Backfill label from name when label is null
    begin
      execute 'update public.categories set label = name where label is null';
    exception when undefined_column then
      null;
    end;
  end if;
end$$;

create table if not exists public.regions (
  code text primary key,
  label text
);

-- RUN LOGS AND QUOTA
create table if not exists public.fetch_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamp with time zone default now(),
  finished_at timestamp with time zone,
  mode text,
  day smallint,
  regions text[],
  categories text[],
  keys_used integer default 0,
  api_calls integer default 0,
  items_discovered integer default 0,
  playlists_valid integer default 0,
  playlists_invalid integer default 0,
  errors jsonb default '[]'::jsonb,
  notes text
);

create table if not exists public.refresh_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamp with time zone default now(),
  finished_at timestamp with time zone,
  mode text,
  day smallint,
  playlists_checked integer default 0,
  playlists_changed integer default 0,
  tracks_added integer default 0,
  tracks_removed integer default 0,
  api_calls integer default 0,
  errors jsonb default '[]'::jsonb,
  notes text
);

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  ts timestamp with time zone default now(),
  api_key_hash text,
  endpoint text,
  quota_cost integer,
  status text,
  error_code text,
  error_message text
);

-- VIEWS
create or replace view public.v_playlists_public as
select
  id, external_id, title, description, cover_url,
  region, category, item_count, last_refreshed_on
from public.playlists
where is_public = true and broken = false;

create or replace view public.v_playlist_track_counts as
select playlist_id, count(*) as track_count
from public.playlist_tracks
group by playlist_id;

-- RLS (optional; if you use direct reads, consider enabling RLS and policies)
-- alter table public.playlists enable row level security;
-- create policy playlists_select_public on public.playlists
--   for select using (is_public = true and broken = false);
