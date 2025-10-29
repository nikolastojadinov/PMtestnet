// ✅ Smart dual scheduler — daily fixed times (Europe/Belgrade)
// 🕘 09:05 → playlists | 🕐 13:00 → tracks
// ⚠️ Deploy ne pokreće automatski fetch (čekaju se cron zakazani termini)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = process.env.TZ || 'Europe/Belgrade';

// 🕘 Svakog dana u 09:05 — preuzimanje plejlisti
const PLAYLIST_SCHEDULE = '5 9 * * *';

// 🕐 Svakog dana u 13:00 — preuzimanje pesama
const TRACK_SCHEDULE = '0 13 * * *';

export function startDualJobs() {
  // 🎧 Fetch Playlists job
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    try {
      console.log(`[scheduler] 09:05 (${TZ}) → Fetch Playlists`);
      await runFetchPlaylists({ reason: 'daily-fetch' });
    } catch (e) {
      console.error('[scheduler] playlists error:', e);
    }
  }, { timezone: TZ });

  // 🎵 Fetch Tracks job
  cron.schedule(TRACK_SCHEDULE, async () => {
    try {
      console.log(`[scheduler] 13:00 (${TZ}) → Fetch Tracks`);
      await runFetchTracks({ reason: 'daily-tracks' });
    } catch (e) {
      console.error('[scheduler] tracks error:', e);
    }
  }, { timezone: TZ });

  console.log(`[scheduler] cron set: playlists@09:05 ${TZ}, tracks@13:00 ${TZ} (fixed only)`);
}
