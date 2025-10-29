# Purple Music

A modern, multilingual music web app focused on curated YouTube music playlists with a sleek dark-purple UI. The app respects YouTube API/SDK rules by using the official YouTube IFrame Player **visibly and unmodified**, showing track title, artist, and a link to the original video. Backend runs on **Render**, frontend on **Netlify**, and **Supabase** is the central database.

> Status: Active development. Frontend and backend scaffolds are present; see `frontend/` and `backend/` folders.

---

## What's New

- v2.7: Home page polish — horizontal carousels with snap scrolling and hover buttons, plus local "Recently Played" sync (persists last 8 playlists in the browser; merged with newest public playlists as fallback).

---

## Highlights

- **Clean UI first**: Build the full player UI and screens before wiring the YouTube IFrame Player.
- **YouTube compliance**: Official IFrame Player, visible branding, no hidden playback, and proper attribution with a link to the original video.
- **Curated content**: Only music playlists (`categoryId = 10`). Global regions (40+ markets) with daily rotation and quality scoring.
- **Premium**: 1 π/week or 3.14 π/month.
- **Multilingual**: 25 languages with full app localization. First-run language syncs with Pi Browser, then persists per user choice.
- **Infra**: Frontend on Netlify; backend on Render (always-on Node, cron jobs, workers); Supabase as DB and storage.

---

## What's New

- v2.9 – Theme polish and final pre-premium UI
	- Theme-aware Header, Footer, Player, and tiles with smooth transitions
	- Animated dropdown in Header; polished mini-player interactions
	- Premium popup remains disabled pending v3.0 reactivation
- v2.8 – Theme Settings
	- Dark / Light / System modes with localStorage persistence and system sync
	- Tailwind dark mode via class toggle on <html>
- v2.7 – Playlist UX Polish
	- Horizontal carousels and local “Recently Played” with merge from public

### v3.0 – Production Release Candidate (RC)

- Dark/Light mode with system sync and persistent preference
- Local “Recently Played” playlists (merged with newest public lists)
- Guest UUID persistence for likes and language
- Static Privacy Policy and Terms pages (linked in header menu)
- YouTube IFrame compliance (visible, ≥200px height, enablejsapi=1)
- Supabase RLS compatibility (public read; guest UUID writes where applicable)
- Global meta tags + PWA manifest for better SEO and installability

## Tech Stack

- **Frontend**: Next.js/React, Tailwind, shadcn/ui, lucide-react.
- **Backend**: Node.js on Render (cron jobs, background workers, key rotation).
- **Database/Storage**: Supabase (Postgres, Storage).
- **Auth/Payments**: Pi Browser / Pi SDK (user info & wallet).
- **Video Playback**: YouTube IFrame Player (official, visible, unmodified).

---

## Environment Variables

Frontend on Netlify (only the 5 essentials):
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `NEXT_PUBLIC_BACKEND_URL`
4. `NEXT_PUBLIC_PI_APP_ID`
5. `NEXT_PUBLIC_FRONTEND_URL`

> Optional values like `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_DEFAULT_LANGUAGE`, `NEXT_PUBLIC_YOUTUBE_API_STATUS` are **not required** for core functionality.

---

## Data Model (Supabase)

Core tables in use during content syncing and playback:

- **playlists**: `external_id`, `title`, `description`, `cover_url`, `region`, `category`, `is_public`, `created_at`, plus YouTube metadata (e.g., `itemCount`, `viewCount` if available, `channelTitle`, `channelSubscriberCount`, etc.), and operational fields: `fetched_on`, `last_refreshed_on`, `last_etag`.
- **tracks**: `id`, `source`, `external_id`, `title`, `artist`, `duration`, `cover_url`, `created_at`, `sync_status`, `last_synced_at`.
- **playlist_tracks**: `playlist_id`, `track_id`, `added_at`, `position`.
- **(testing-only, periodically cleared)**: `users`, `likes`, `statistics`, `cache`, `search_cache`, `v_playlists_full` (view for unrestricted reading).

App intentionally **retains only playlists and tracks**; user-related tables are periodically cleared during login tests.

---

## Localization (25 Languages)

Vietnamese, Hindi, English, Korean, Amharic, Nigerian English, Indonesian, Filipino/Tagalog, Malay, Urdu, Bengali, Thai, Russian, Portuguese, Turkish, German, French, Spanish, Italian, Dutch, Polish, Hungarian, Czech, Greek, Serbian.

- On first open, language = Pi Browser language.
- If user changes language in Profile menu, app persists choice and reuses it next launch.
- All visible strings are localized.

---

## UI Structure

- **Header**  
	- Left: “Purple Music” logo/title (purple-yellow palette)  
	- Right: Profile icon ➜ dropdown: Username · Language selector · Go Premium / “Premium member until [date]” · Privacy Policy · Terms of Service

- **Footer (sticky)**  
	- Outline icons in this order: Home · Search · Liked Songs · My Playlists

- **Home**  
	- Black background  
	- Top: **Search** (local Supabase data; realtime as you type)  
	- Then: two columns × four **Recently Played Playlists** (persisted per user)  
	- Then: horizontal categories (8 playlists per row; partially visible, scroll to reveal): “Most popular”, “Trending now”, “Best of 80s”, “Best of 90s”, “Best of 2000”, etc.

- **Playlist Page**  
	- Top: cover image  
	- Title + **Play All** (plays in order in the audio player)  
	- Vertical track list; each row: **Like**, **Play**, **Add to Playlist**  
	- “Add to Playlist” opens a popup with user playlists; if none, empty list  
	- Play by clicking the Play button or the row body

- **Player**  
	- Build UI first (Play/Pause, Next, Previous, Like, Add to Playlist).  
	- Then embed the **official YouTube IFrame Player** (visible, unmodified) showing title/artist + link to the original video.  
	- Allowed popup: “Go Premium” (5s or close via X) before starting playback. Popup is separate from the player and does not cover the YouTube video.

---

## Playlist Fetch & Refresh (Backend on Render)

Two schedules are used (both compliant with YT terms and quotas):

1) **Daily rhythm**  
- 00:00–12:00: Keys 1–3 fetch **new** playlists/tracks.  
- 12:00–24:00: Keys 4–6 **refresh** items fetched the previous day.  
- Round-robin rotation within the active key set.

2) **30-day cycle**  
- Days 1–30: Six keys perform fetches 24/7.  
- Day 31: Full refresh across all previously fetched playlists.  
- Then the cycle repeats.

Region coverage uses a JSON of ISO region codes, rotating 8–10 regions daily. Supabase fields include `region`, `language_guess`, `category`, `quality_score`.

---

## Compliance

- **YouTube**: Uses the official IFrame Player, visible and unmodified; shows video title/artist; provides a link to the original YouTube video; no deceptive UI or hidden playback.  
- **Privacy**: Only necessary data is stored; user tables are periodically cleared in testing.  
- **Branding**: No misuse of YouTube or Spotify marks.  
- **APIs**: Adhere to YouTube and Spotify Developer Terms (API/SDK, privacy, branding, and restrictions).

---

## Deploy

- **Frontend**: Netlify (set the 5 env vars only).  
- **Backend**: Render (always-on Node, cron jobs, background workers, env management).  
- **Database**: Supabase (SQL editor, storage, auth integration with Pi SDK where needed).

### Netlify setup (frontend)

This repo includes a `netlify.toml` configured for the Next.js app in `frontend/`:

- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `.next` (handled by the official Next.js Netlify plugin)

Steps:
- Create a new site from Git in Netlify and point it to this repository.
- Netlify will detect `netlify.toml` and wire the Next.js plugin automatically.
- Add the 5 required environment variables in Site settings ➜ Environment.
- Trigger a deploy. The plugin will produce optimized output and serverless functions where needed.

---

## Development Notes

- Start with UI scaffolding and localization.  
- Embed IFrame Player only after UI is finalized.  
- Use full-file rewrites for components to keep code clean and consistent.  
- Keep repo lean: only necessary files, consistent formatting, no leftover experiments.

---

## License

TBD.
