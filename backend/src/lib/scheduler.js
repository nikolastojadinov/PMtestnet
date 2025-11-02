// ✅ Fixed UTC scheduler for daily playlist + hourly cleanup/track fetch
// 🔹 runFetchPlaylists once daily at 09:05 UTC
// 🔹 cleanEmptyPlaylists hourly at :45 from 12:45 → 21:45 UTC
// 🔹 fetchTracksFromPlaylist hourly at :00 from 13:00 → 22:00 UTC
// 🔹 Timezone: UTC (Render uses UTC)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { cleanEmptyPlaylists } from '../jobs/cleanEmptyPlaylists.js';
import { fetchTracksFromPlaylist } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = 'UTC';

// 📥 Daily playlists fetch: 09:05 UTC
const PLAYLIST_SCHEDULE = '5 9 * * *';

// 🧹 Cleanup times (12:45 → 21:45 UTC)
const CLEAN_SCHEDULES = [
  '45 12 * * *',
  '45 13 * * *',
  '45 14 * * *',
  '45 15 * * *',
  '45 16 * * *',
  '45 17 * * *',
  '45 18 * * *',
  '45 19 * * *',
  '45 20 * * *',
  '45 21 * * *',
];

// 🎵 Track fetch times (13:00 → 22:00 UTC)
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

  // 🧹 Cleanup prior to hourly track fetch windows — store target playlist ids
  CLEAN_SCHEDULES.forEach((pattern, i) => {
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

  // 🎵 Hourly track fetch windows (13:00–22:00 UTC)
  TRACK_SCHEDULES.forEach((pattern, i) => {
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

  console.log(`[scheduler] ✅ cron set (UTC):
  - playlists@09:05
  - cleanup@12:45→21:45
  - tracks@13:00→22:00`);
}
