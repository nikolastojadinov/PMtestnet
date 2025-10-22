// ✅ FULL REWRITE — Dva dnevna joba: plejliste u 09:05 i pesme u 14:00 lokalno

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';

export function startDualJobs() {
  // 🎧 Fetch plejlista (09:05 lokalno = 07:05 UTC)
  cron.schedule('5 7 * * *', async () => {
    console.log('[scheduler] 09:05 → FETCH PLAYLISTS');
    await runFetchPlaylists({ reason: 'daily-09:05' });
  }, { timezone: 'UTC' });

  // 🎵 Fetch pesama (14:00 lokalno = 12:00 UTC)
  cron.schedule('0 12 * * *', async () => {
    console.log('[scheduler] 14:00 → FETCH TRACKS');
    await runFetchTracks({ reason: 'daily-14:00' });
  }, { timezone: 'UTC' });

  console.log('[scheduler] cron set: playlists@07:05 UTC, tracks@12:00 UTC');
}
