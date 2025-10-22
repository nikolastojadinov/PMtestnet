// ✅ FULL REWRITE — Dual scheduler with quota balance (Playlists @09:05, Tracks @14:00)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

// 🕘 09:05 lokalno = 07:05 UTC
const PLAYLIST_SCHEDULE = '5 7 * * *';
// 🕑 14:00 lokalno = 12:00 UTC
const TRACK_SCHEDULE = '0 12 * * *';

// 🚀 Start oba dnevna joba
export function startDualJobs() {
  console.log('[scheduler:init] dual cron scheduler starting...');
  console.log('[scheduler:init] playlists → 09:05 local (07:05 UTC)');
  console.log('[scheduler:init] tracks → 14:00 local (12:00 UTC)');
  console.log('──────────────────────────────────────────────');

  // 🎧 Playlists fetch job
  cron.schedule(
    PLAYLIST_SCHEDULE,
    async () => {
      const now = new Date().toISOString();
      console.log(`\n[scheduler] ▶ ${now} → Starting Playlists Fetch`);
      try {
        await runFetchPlaylists({ reason: 'daily-playlists' });
        console.log('[scheduler] ✅ Playlists job finished successfully.');
      } catch (e) {
        console.error('[scheduler] ❌ playlists job error:', e.message || e);
      }
    },
    { timezone: 'UTC' }
  );

  // 🎵 Tracks fetch job
  cron.schedule(
    TRACK_SCHEDULE,
    async () => {
      const now = new Date().toISOString();
      console.log(`\n[scheduler] ▶ ${now} → Starting Tracks Fetch`);
      try {
        await runFetchTracks({ reason: 'daily-tracks' });
        console.log('[scheduler] ✅ Tracks job finished successfully.');
      } catch (e) {
        console.error('[scheduler] ❌ tracks job error:', e.message || e);
      }
    },
    { timezone: 'UTC' }
  );

  console.log(
    '[scheduler] cron set → playlists@07:05 UTC (09:05 local), tracks@12:00 UTC (14:00 local)\n'
  );
}
