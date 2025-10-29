// ✅ FULL REWRITE v3.9 — fixed job filenames + 16:35 cron Europe/Belgrade

import cron from 'node-cron';
import { runFetchPlaylists } from './jobs/fetchPlaylists.js';
import { runFetchTracks } from './jobs/fetchTracksFromPlaylist.js';

const TIMEZONE = 'Europe/Belgrade';

// 🕙 Svakog dana u 10:10 preuzima plejliste
const PLAYLISTS_CRON = '10 10 * * *';

// 🎵 Svakog dana u 16:35 preuzima pesme iz plejlista
const TRACKS_CRON = '35 16 * * *';

export function initScheduler() {
  console.log(`[scheduler] cron set: playlists@10:10 ${TIMEZONE}, tracks@16:35 ${TIMEZONE} (jobs dir)`);

  // 🎧 Preuzimanje plejlista
  cron.schedule(PLAYLISTS_CRON, async () => {
    console.log(`[cron] Starting playlist fetch... (${new Date().toISOString()})`);
    try {
      await runFetchPlaylists({ reason: 'scheduled-playlists' });
    } catch (e) {
      console.error('[cron:playlists] error:', e);
    }
  }, { timezone: TIMEZONE });

  // 🎶 Preuzimanje pesama
  cron.schedule(TRACKS_CRON, async () => {
    console.log(`[cron] Starting track fetch... (${new Date().toISOString()})`);
    try {
      await runFetchTracks({ reason: 'scheduled-tracks' });
    } catch (e) {
      console.error('[cron:tracks] error:', e);
    }
  }, { timezone: TIMEZONE });
}
