// ✅ FULL REWRITE — Dual scheduler: playlists @10:35, tracks @13:00 local
import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

// 10:35 lokalno = 08:35 UTC
const PLAYLIST_SCHEDULE = '35 8 * * *';
// 13:00 lokalno = 11:00 UTC (ne menja se)
const TRACK_SCHEDULE = '0 11 * * *';

export function startDualJobs() {
  // 🎧 Playlists job
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    try {
      console.log('[scheduler] 10:35 → Fetch Playlists');
      await runFetchPlaylists({ reason: 'daily-playlists' });
    } catch (e) {
      console.error('[scheduler] playlists job error:', e);
    }
  }, { timezone: 'UTC' });

  // 🎵 Tracks job
  cron.schedule(TRACK_SCHEDULE, async () => {
    try {
      console.log('[scheduler] 13:00 → Fetch Tracks');
      await runFetchTracks({ reason: 'daily-tracks' });
    } catch (e) {
      console.error('[scheduler] tracks job error:', e);
    }
  }, { timezone: 'UTC' });

  // 🟢 Startup auto-run fallback
  runFetchPlaylists({ reason: 'startup-initial' })
    .then(() => setTimeout(() => runFetchTracks({ reason: 'startup-followup' }), 5 * 60 * 1000))
    .catch(err => console.error('[startup] initial fetch error:', err));

  console.log('[scheduler] cron set: playlists@08:35 UTC (10:35 local), tracks@11:00 UTC (13:00 local)');
}
