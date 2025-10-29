// ✅ Smart dual scheduler — fixed daily times (Europe/Belgrade)
// 🕙 10:00 → playlists | 🕐 13:00 → tracks
// ⚠️ No startup auto-run (deploy ne pokreće ništa!)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = process.env.TZ || 'Europe/Belgrade';
const PLAYLIST_SCHEDULE = '0 10 * * *';  // 10:00 lokalno
const TRACK_SCHEDULE    = '0 13 * * *';  // 13:00 lokalno

export function startDualJobs() {
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    try {
      console.log(`[scheduler] 10:00 (${TZ}) → Fetch Playlists`);
      await runFetchPlaylists({ reason: 'daily-fetch' });
    } catch (e) {
      console.error('[scheduler] playlists error:', e);
    }
  }, { timezone: TZ });

  cron.schedule(TRACK_SCHEDULE, async () => {
    try {
      console.log(`[scheduler] 13:00 (${TZ}) → Fetch Tracks`);
      await runFetchTracks({ reason: 'daily-tracks' });
    } catch (e) {
      console.error('[scheduler] tracks error:', e);
    }
  }, { timezone: TZ });

  console.log(`[scheduler] cron set: playlists@10:00 ${TZ}, tracks@13:00 ${TZ} (fixed only)`);
}
