// ✅ Fixed daily scheduler — Europe/Belgrade
// 🔹 09:05 → fetch playlists (FETCH only)
// 🔹 14:45 → fetch tracks (REFRESH always active)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = 'Europe/Belgrade';

// CRON format: minute hour day month weekday
const PLAYLIST_SCHEDULE = '5 9 * * *';     // 09:05
const TRACK_SCHEDULE = '45 14 * * *';      // 14:45

export function startDualJobs() {
  // 🎵 Fetch playlists (morning job)
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    console.log(`[scheduler] 09:05 (${TZ}) → Fetch Playlists`);
    await runFetchPlaylists();
  }, { timezone: TZ });

  // 🎶 Fetch tracks (afternoon job)
  cron.schedule(TRACK_SCHEDULE, async () => {
    console.log(`[scheduler] 14:45 (${TZ}) → Fetch Tracks`);
    await runFetchTracks();
  }, { timezone: TZ });

  console.log(`[scheduler] cron set: playlists@09:05 ${TZ}, tracks@14:45 ${TZ}`);
}
