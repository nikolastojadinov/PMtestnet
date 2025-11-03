# Supabase migrations for the 29‑day YouTube system

This folder contains SQL you can run in the Supabase SQL editor (or psql) to initialize the schema, seed configuration, and add RPCs.

## Order of execution

1. `backend/sql/001_schema.sql`
2. `backend/sql/002_seed_regions.sql`
3. `backend/sql/003_seed_categories.sql`
4. `backend/sql/010_rpc.sql`
5. `backend/sql/011_pit_schema_v5_3_1.sql` (optional additive migration: users/likes/statistics/cache, expanded playlists/tracks, and refreshed views)

> Note: You can re-run seeds at any time; inserts use `on conflict do nothing`.

## What this sets up

- Core tables: `playlists_raw`, `playlists`, `tracks`, `playlist_tracks`
- Config: `settings`, `regions`, `categories`
- Runs / quota: `fetch_runs`, `refresh_runs`, `api_usage`
- Views: `v_playlists_public`, `v_playlist_track_counts`
  - PIT v5.3.1 adds: `v_playlists_full` and refreshes `v_playlists_public`
- RPCs: `get_empty_playlists(limit_count)`

## Applying the SQL

- Open Supabase project → SQL → Run new query → paste file contents in order.
- Alternatively, use `psql` with your project connection string.

## Next steps

- Populate `settings` with a cycle start date:
  ```sql
  insert into public.settings(key, value)
  values ('cycle', '{"start_ymd":"2025-10-29","period_days":29}')
  on conflict (key) do update set value = excluded.value, updated_at = now();
  ```
- Expand `categories` to full 140 items (this repo seeds an initial set as a template).
- Optionally enable RLS on `playlists` and serve public data via the view `v_playlists_public`.

## Compatibility with existing backend

- Existing jobs can continue writing directly to `playlists` and `tracks`.
- When ready, migrate flow to use `playlists_raw → playlists` validation and log runs in `fetch_runs`/`refresh_runs`.
