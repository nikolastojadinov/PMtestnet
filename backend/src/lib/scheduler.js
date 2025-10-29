// ✅ FULL REWRITE v3.6 — Fixed import paths + cron 16:30 Europe/Belgrade

import cron from 'node-cron';
import { runFetchPlaylists } from './fetch/fetchPlaylists.js';
import { runFetchTracks } from './fetch/fetchTracks.js';

const TIMEZONE = 'Europe/Belgrade';

// 🕙 Preuzimanje plejlista u 10:10 lokalno
const PLAYLISTS_CRON = '10 10 * * *';

// 🎵 Preuzimanje pesama u 16:30 lokalno
const TRACKS_CRON = '30 16 * * *';

export function initScheduler() {
  console.log(`[scheduler] cron set: playlists@10:10 ${TIMEZONE}, tracks@16:30 ${TIMEZONE} (fixed only)`);

  // 🎧 Fetch playlists
  cron.schedule(PLAYLISTS_CRON, async () => {
    console.log(`[cron] Starting playlist fetch... (${new Date().toISOString()})`);
    try {
      await runFetchPlaylists({ reason: 'scheduled-playlists' });
    } catch (e) {
      console.error('[cron:playlists] error:', e);
    }
  }, { timezone: TIMEZONE });

  // 🎶 Fetch tracks
  cron.schedule(TRACKS_CRON, async () => {
    console.log(`[cron] Starting track fetch... (${new Date().toISOString()})`);
    try {
      await runFetchTracks({ reason: 'scheduled-tracks' });
    } catch (e) {
      console.error('[cron:tracks] error:', e);
    }
  }, { timezone: TIMEZONE });
}
