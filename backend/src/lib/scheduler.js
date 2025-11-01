// ✅ Multi-slot daily scheduler — Europe/Belgrade
// 🔹 09:05 → fetch playlists (FETCH only)
// 🔹 13:00, 14:00, 15:00 ... 22:00 → fetch tracks (REFRESH in 10 fixed runs)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

const TZ = 'Europe/Belgrade';

// CRON format: minute hour day month weekday
const PLAYLIST_SCHEDULE = '5 9 * * *'; // 09:05
const TRACK_HOURS = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22]; // 10 runs per day

export function startDualJobs() {
  // 🎵 Fetch playlists once daily
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    console.log(`[scheduler] 09:05 (${TZ}) → Fetch Playlists`);
    await runFetchPlaylists();
  }, { timezone: TZ });

  // 🎶 Fetch tracks hourly from 13h to 22h
  for (const hour of TRACK_HOURS) {
    const expr = `0 ${hour} * * *`; // every full hour between 13–22
    cron.schedule(expr, async () => {
      console.log(`[scheduler] ${hour}:00 (${TZ}) → Fetch Tracks`);
      await runFetchTracks();
    }, { timezone: TZ });
  }

  console.log(`[scheduler] cron set:
  playlists@09:05 ${TZ},
  tracks@13–22h every hour (${TZ})`);
}
