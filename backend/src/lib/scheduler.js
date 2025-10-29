// ✅ Smart dual scheduler — fixed daily times (Europe/Belgrade)
// 🕥 10:10 → playlists | 🕟 16:40 → tracks
// ⚠️ No startup auto-run (deploy ne pokreće ništa!)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = process.env.TZ || 'Europe/Belgrade';
const PLAYLIST_SCHEDULE = '10 10 * * *';   // 10:10 lokalno
const TRACK_SCHEDULE    = '40 16 * * *';   // 16:40 lokalno

export function startDualJobs() {
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    try {
      console.log(`[scheduler] 10:10 (${TZ}) → Fetch Playlists`);
      await runFetchPlaylists({ reason: 'daily-fetch' });
    } catch (e) {
      console.error('[scheduler] playlists error:', e);
    }
  }, { timezone: TZ });

  cron.schedule(TRACK_SCHEDULE, async () => {
    try {
      console.log(`[scheduler] 16:40 (${TZ}) → Fetch Tracks`);
      await runFetchTracks({ reason: 'daily-tracks' });
    } catch (e) {
      console.error('[scheduler] tracks error:', e);
    }
  }, { timezone: TZ });

  console.log(`[scheduler] cron set: playlists@10:10 ${TZ}, tracks@16:40 ${TZ} (fixed only)`);
}
