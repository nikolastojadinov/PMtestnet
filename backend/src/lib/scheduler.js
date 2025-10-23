// ✅ FULL REWRITE — Dual scheduler: playlists @09:05, tracks @15:30 local

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

// 09:05 lokalno = 07:05 UTC
const PLAYLIST_SCHEDULE = '5 7 * * *';
// 15:30 lokalno = 13:30 UTC
const TRACK_SCHEDULE = '30 13 * * *';

export function startDualJobs() {
  // 🎧 Playlists
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    try {
      console.log('[scheduler] 09:05 → Fetch Playlists');
      await runFetchPlaylists({ reason: 'daily-playlists' });
    } catch (e) {
      console.error('[scheduler] playlists job error:', e);
    }
  }, { timezone: 'UTC' });

  // 🎵 Tracks
  cron.schedule(TRACK_SCHEDULE, async () => {
    try {
      console.log('[scheduler] 15:30 → Fetch Tracks');
      await runFetchTracks({ reason: 'daily-tracks' });
    } catch (e) {
      console.error('[scheduler] tracks job error:', e);
    }
  }, { timezone: 'UTC' });

  console.log('[scheduler] cron set: playlists@07:05 UTC (09:05 local), tracks@13:30 UTC (15:30 local)');
}
