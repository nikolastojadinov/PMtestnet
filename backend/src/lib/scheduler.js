// ✅ FULL REWRITE v5.2 — Local-time aligned scheduler (Europe/Budapest)
// 🔹 runFetchPlaylists once daily at 11:05 local (10:05 UTC)
// 🔹 cleanEmptyPlaylists hourly at :55 from 12:55 → 21:55 local (11:55 → 20:55 UTC)
// 🔹 fetchTracksFromPlaylist hourly at :00 from 13:00 → 22:00 local (12:00 → 21:00 UTC)
// 🔹 Timezone: UTC (Render uses UTC), but all times adjusted to match Nikola’s local time

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { cleanEmptyPlaylists } from '../jobs/cleanEmptyPlaylists.js';
import { fetchTracksFromPlaylist } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = 'UTC';

// 📥 Daily playlists fetch — 11:05 local = 10:05 UTC
const PLAYLIST_SCHEDULE = '5 10 * * *';

// 🧹 Cleanup times — 12:55 → 21:55 local = 11:55 → 20:55 UTC
const CLEAN_SCHEDULES = [
  '55 11 * * *',
  '55 12 * * *',
  '55 13 * * *',
  '55 14 * * *',
  '55 15 * * *',
  '55 16 * * *',
  '55 17 * * *',
  '55 18 * * *',
  '55 19 * * *',
  '55 20 * * *',
];

// 🎵 Track fetch times — 13:00 → 22:00 local = 12:00 → 21:00 UTC
const TRACK_SCHEDULES = [
  '0 12 * * *',
  '0 13 * * *',
  '0 14 * * *',
  '0 15 * * *',
  '0 16 * * *',
  '0 17 * * *',
  '0 18 * * *',
  '0 19 * * *',
  '0 20 * * *',
  '0 21 * * *',
];

export function startFixedJobs() {
  // 📥 Daily playlist discovery
  cron.schedule(
    PLAYLIST_SCHEDULE,
    async () => {
      console.log(`[scheduler] ${PLAYLIST_SCHEDULE} (${TZ}) → Fetch playlists (daily)`);
      await runFetchPlaylists();
    },
    { timezone: TZ }
  );

  // 🧹 Cleanup before hourly track fetch windows
  CLEAN_SCHEDULES.forEach((pattern) => {
    cron.schedule(
      pattern,
      async () => {
        console.log(`[scheduler] ${pattern} (${TZ}) → Clean empty playlists`);
        const ids = await cleanEmptyPlaylists();
        const count = Array.isArray(ids) ? ids.length : 0;
        globalThis.__pm_emptyPlaylistIds = ids || [];
        console.log(`[scheduler] Selected ${count} empty playlists for next track fetch window.`);
      },
      { timezone: TZ }
    );
  });

  // 🎵 Hourly track fetch windows (13:00–22:00 local)
  TRACK_SCHEDULES.forEach((pattern) => {
    cron.schedule(
      pattern,
      async () => {
        const target = Array.isArray(globalThis.__pm_emptyPlaylistIds)
          ? globalThis.__pm_emptyPlaylistIds
          : [];
        console.log(`[scheduler] ${pattern} (${TZ}) → Fetch tracks (${target.length} playlists)`);
        if (!target.length) {
          console.log('[scheduler] No target playlists from last cleanup; skipping.');
          return;
        }
        await fetchTracksFromPlaylist(target);
      },
      { timezone: TZ }
    );
  });

  console.log(`[scheduler] ✅ cron set (UTC, aligned to local time):
  - playlists@10:05 UTC (11:05 local)
  - cleanup@11:55→20:55 UTC (12:55→21:55 local)
  - tracks@12:00→21:00 UTC (13:00→22:00 local)`);
}
