// ✅ FULL REWRITE v3.0 — Multi-hour scheduler for playlist cleanup and track fetching
// 🔹 Cleans empty playlists at :55 (12:55 → 21:55)
// 🔹 Fetches tracks each full hour from 13:00 → 22:00
// 🔹 Timezone: Europe/Belgrade

import cron from 'node-cron';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';
import { runCleanEmptyPlaylists } from '../jobs/cleanEmptyPlaylists.js';

const TZ = 'Europe/Belgrade';

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

export function startDualJobs() {
  // 🔁 Cleanup pre svakog fetch ciklusa
  CLEAN_SCHEDULES.forEach((pattern, i) => {
    cron.schedule(
      pattern,
      async () => {
        console.log(`[scheduler] ${pattern} (${TZ}) → Clean empty playlists`);
        await runCleanEmptyPlaylists({ reason: `cleanup-${i + 1}` });
      },
      { timezone: TZ }
    );
  });

  // 🎵 Fetch tracks svakog punog sata (13h–22h)
  TRACK_SCHEDULES.forEach((pattern, i) => {
    cron.schedule(
      pattern,
      async () => {
        console.log(`[scheduler] ${pattern} (${TZ}) → Fetch tracks`);
        await runFetchTracks({ reason: `hourly-fetch-${i + 1}` });
      },
      { timezone: TZ }
    );
  });

  console.log(`[scheduler] ✅ cron set:
  - cleanup@12:55→21:55
  - tracks@13:00→22:00 (${TZ})`);
}
