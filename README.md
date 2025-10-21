# PMtestnet
Purple Music — modern Pi Browser web app for streaming music via YouTube IFrame API, Supabase, and Render backend. Automatic Pi SDK login, playlists sync, payments in Pi currency, and multilingual support. Built with Next.js on Netlify.

## Render (Backend) environment

Set the following environment variables in your Render service (Dashboard → Environment):

- SUPABASE_URL
- SUPABASE_SERVICE_KEY  (preferred) or SUPABASE_ANON_KEY
- YOUTUBE_API_KEYS      (comma-separated)

Build command: `cd backend && npm ci`

Start command: `cd backend && npm run start`

Node version is pinned via `backend/package.json` engines to `22.x`.

## Backend data writes: safe default vs rich mode

The backend now supports a safe default write mode and an optional rich write mode for Supabase:

- Default (safe): Only upserts record existence (IDs only). This avoids errors when the production DB schema is missing newer columns.
- Rich mode (optional): Writes full metadata to `playlists`, `tracks`, and `playlist_tracks` once the rich columns exist.

Enable rich mode after applying the SQL migration:

1) Apply the migration in Supabase
- Open your Supabase project's SQL editor
- Paste and run the file `db/migrations/2025-10-17_rich_schema.sql`

2) Toggle rich mode in the backend
- Set env var `SUPABASE_RICH_SCHEMA=1` in your Render service (or local `.env`)
- Restart the service. The backend will begin upserting rich columns:
	- playlists: name, description, cover_url, region, category, item_count, channel_title, fetched_on, view_count, channel_subscriber_count, last_etag, updated_at
	- tracks: title, artist, published_at, thumbnail_url, created_at, updated_at
	- playlist_tracks: position, updated_at

If the migration is not applied, keep `SUPABASE_RICH_SCHEMA` unset or `0` and the backend will continue using the safe minimal payloads.

### Note on IDs (UUID mapping)

- Database primary keys are UUIDs. We deterministically derive them from YouTube IDs using UUID v5:
	- playlists: `uuidv5('ytpl:'+ytPlaylistId, DNS)`
	- tracks: `uuidv5('ytv:'+ytVideoId, DNS)`
- In rich mode, original YouTube IDs are also stored in `external_id` (text) columns for reference.
