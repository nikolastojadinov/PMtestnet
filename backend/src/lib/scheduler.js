// ✅ Fixed daily scheduler — Europe/Belgrade
// 🔹 09:05 → fetch playlists (FETCH only)
// 🔹 13:00 → fetch tracks (REFRESH always active)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = 'Europe/Belgrade';
const PLAYLIST_SCHEDULE = '5 9 * * *';
const TRACK_SCHEDULE = '0 13 * * *';

export function startDualJobs() {
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    console.log(`[scheduler] 09:05 (${TZ}) → Fetch Playlists`);
    await runFetchPlaylists();
  }, { timezone: TZ });

  cron.schedule(TRACK_SCHEDULE, async () => {
    console.log(`[scheduler] 13:00 (${TZ}) → Fetch Tracks`);
    await runFetchTracks();
  }, { timezone: TZ });

  console.log(`[scheduler] cron set: playlists@09:05 ${TZ}, tracks@13:00 ${TZ}`);
}
