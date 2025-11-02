// backend/src/lib/scheduler.js
// ✅ Fixed paths + fixed local timezone (Europe/Budapest)
// ✅ Playlists @ 13:05 local; Cleanup @ 13:55→22:55; Tracks @ 14:00→23:00

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { cleanEmptyPlaylists } from '../jobs/cleanEmptyPlaylists.js';
import { fetchTracksFromPlaylist } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = 'Europe/Budapest';

// 📥 Daily playlists fetch: 13:05 local
const PLAYLIST_SCHEDULE = '5 13 * * *';

// 🧹 Cleanup times (:55 from 13:55 → 22:55 local)
const CLEAN_SCHEDULES = [
  '55 13 * * *','55 14 * * *','55 15 * * *','55 16 * * *','55 17 * * *',
  '55 18 * * *','55 19 * * *','55 20 * * *','55 21 * * *','55 22 * * *',
];

// 🎵 Track fetch times (:00 from 14:00 → 23:00 local)
const TRACK_SCHEDULES = [
  '0 14 * * *','0 15 * * *','0 16 * * *','0 17 * * *','0 18 * * *',
  '0 19 * * *','0 20 * * *','0 21 * * *','0 22 * * *','0 23 * * *',
];

export function startFixedJobs() {
  // Daily playlist discovery
  cron.schedule(
    PLAYLIST_SCHEDULE,
    async () => {
      console.log(`[scheduler] ${PLAYLIST_SCHEDULE} (${TZ}) → Fetch playlists (daily)`);
      await runFetchPlaylists();
    },
    { timezone: TZ }
  );

  // Cleanup prije svakog track fetch prozora — bira prazne playliste (ne briše)
  CLEAN_SCHEDULES.forEach((pattern) => {
    cron.schedule(
      pattern,
      async () => {
        console.log(`[scheduler] ${pattern} (${TZ}) → Clean empty playlists (select targets)`);
        const ids = await cleanEmptyPlaylists(); // vraća array external_id
        const count = Array.isArray(ids) ? ids.length : 0;
        globalThis.__pm_emptyPlaylistIds = ids || [];
        console.log(`[scheduler] Selected ${count} empty playlists for next track window.`);
      },
      { timezone: TZ }
    );
  });

  // Track fetch windows
  TRACK_SCHEDULES.forEach((pattern) => {
    cron.schedule(
      pattern,
      async () => {
        const target = Array.isArray(globalThis.__pm_emptyPlaylistIds)
          ? globalThis.__pm_emptyPlaylistIds
          : [];
        console.log(`[scheduler] ${pattern} (${TZ}) → Fetch tracks (${target.length} playlists)`);
        if (!target.length) {
          console.log('[scheduler] No selected empty playlists; skipping this window.');
          return;
        }
        await fetchTracksFromPlaylist(target);
      },
      { timezone: TZ }
    );
  });

  console.log(`[scheduler] ✅ cron set (${TZ}):
  - playlists@13:05
  - cleanup@13:55→22:55
  - tracks@14:00→23:00`);
}
