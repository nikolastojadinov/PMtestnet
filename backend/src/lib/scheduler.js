// ✅ FULL REWRITE — Dual scheduler: playlists @09:05, tracks @14:45 local

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

// 09:05 lokalno = 07:05 UTC
const PLAYLIST_SCHEDULE = '5 7 * * *';
// 14:45 lokalno = 12:45 UTC
const TRACK_SCHEDULE = '45 12 * * *';

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
      console.log('[scheduler] 14:45 → Fetch Tracks');
      await runFetchTracks({ reason: 'daily-tracks' });
    } catch (e) {
      console.error('[scheduler] tracks job error:', e);
    }
  }, { timezone: 'UTC' });

  console.log('[scheduler] cron set: playlists@07:05 UTC (09:05 local), tracks@12:45 UTC (14:45 local)');
}
