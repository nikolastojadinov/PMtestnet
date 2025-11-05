// backend/src/lib/scheduler.js
// ✅ Fixed local-time schedule for cloud runtimes
// ✅ Timezone: Europe/Budapest (can override with TZ env)
// ✅ Playlists @ 10:10; Cleanup @ 12:45→21:45; Tracks @ 13:00→22:00 (all local time)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { cleanEmptyPlaylists } from '../jobs/cleanEmptyPlaylists.js';
import { fetchTracksFromPlaylist } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = process.env.TZ || 'Europe/Budapest';

// 📥 Daily playlists fetch: 09:05 local time
const PLAYLIST_SCHEDULE = '5 9 * * *';

// 🧹 Cleanup times (:45 from 12:45 → 21:45 local time)
const CLEAN_SCHEDULES = [
  '45 12 * * *','45 13 * * *','45 14 * * *','45 15 * * *','45 16 * * *',
  '45 17 * * *','45 18 * * *','45 19 * * *','45 20 * * *','45 21 * * *',
];

// 🎵 Track fetch times (:00 from 13:00 → 22:00 local time)
const TRACK_SCHEDULES = [
  '0 13 * * *','0 14 * * *','0 15 * * *','0 16 * * *','0 17 * * *',
  '0 18 * * *','0 19 * * *','0 20 * * *','0 21 * * *','0 22 * * *',
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

  // Cleanup before track fetch window — select empty playlists (no delete)
  CLEAN_SCHEDULES.forEach((pattern) => {
    cron.schedule(
      pattern,
      async () => {
        console.log(`[scheduler] ${pattern} (${TZ}) → Clean empty playlists (select targets)`);
  const ids = await cleanEmptyPlaylists(); // returns array of playlist UUIDs
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
  - playlists@09:05
  - cleanup@12:45→21:45
  - tracks@13:00→22:00`);

  // Additional clarity logs
  console.log(`[scheduler] ⏰ Playlist fetch job active at ${PLAYLIST_SCHEDULE} (${TZ})`);
  console.log('[scheduler] ✅ YouTube key rotation system integrated and logging to api_usage table.');
}
