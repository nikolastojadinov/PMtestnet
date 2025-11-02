// ✅ Scheduler v4.0 — Local time: Europe/Budapest
// 🔹 Playlists daily @12:30 local
// 🔹 Cleanup hourly @12:55→21:55 local
// 🔹 Track fetch hourly @13:00→22:00 local

import cron from 'node-cron';
import { runFetchPlaylists } from './jobs/fetchPlaylists.js';
import { cleanEmptyPlaylists } from './jobs/cleanEmptyPlaylists.js';
import { fetchTracksFromPlaylist } from './jobs/fetchTracksFromPlaylist.js';

const TZ = 'Europe/Budapest';

// 📥 Daily playlists fetch — 12:30 local
const PLAYLIST_SCHEDULE = '30 12 * * *';

// 🧹 Cleanup times (12:55 → 21:55)
const CLEAN_SCHEDULES = [
  '55 12 * * *',
  '55 13 * * *',
  '55 14 * * *',
  '55 15 * * *',
  '55 16 * * *',
  '55 17 * * *',
  '55 18 * * *',
  '55 19 * * *',
  '55 20 * * *',
  '55 21 * * *',
];

// 🎵 Track fetch times (13:00 → 22:00)
const TRACK_SCHEDULES = [
  '0 13 * * *',
  '0 14 * * *',
  '0 15 * * *',
  '0 16 * * *',
  '0 17 * * *',
  '0 18 * * *',
  '0 19 * * *',
  '0 20 * * *',
  '0 21 * * *',
  '0 22 * * *',
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

  // 🧹 Cleanup before track fetch windows
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

  // 🎵 Hourly track fetch
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

  console.log(`[scheduler] ✅ cron set (${TZ}):
  - playlists@12:30
  - cleanup@12:55→21:55
  - tracks@13:00→22:00`);
}
