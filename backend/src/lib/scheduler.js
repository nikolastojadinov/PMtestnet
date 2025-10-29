// ✅ FULL REWRITE v3.5 — Cron scheduler (Europe/Belgrade precision)
// Pokreće preuzimanje plejlista i pesama u tačno definisano lokalno vreme
// Vreme sada: playlists@10:10, tracks@16:30 (Europe/Belgrade)

import cron from 'node-cron';
import { runFetchPlaylists } from './fetch/fetchPlaylists.js';
import { runFetchTracks } from './fetch/fetchTracks.js';

const TIMEZONE = 'Europe/Belgrade';

// 🕙 Svakog dana u 10:10 preuzima nove plejliste
const PLAYLISTS_CRON = '10 10 * * *';

// 🎵 Svakog dana u 16:30 preuzima pesme (tracks)
const TRACKS_CRON = '30 16 * * *';

export function initScheduler() {
  console.log(`[scheduler] cron set: playlists@10:10 ${TIMEZONE}, tracks@16:30 ${TIMEZONE} (fixed only)`);

  // 🟣 Job 1: Preuzimanje plejlista
  cron.schedule(PLAYLISTS_CRON, async () => {
    console.log(`[cron] Starting playlist fetch... (${new Date().toISOString()})`);
    try {
      await runFetchPlaylists({ reason: 'scheduled-playlists' });
    } catch (e) {
      console.error('[cron:playlists] error:', e);
    }
  }, { timezone: TIMEZONE });

  // 🟣 Job 2: Preuzimanje pesama
  cron.schedule(TRACKS_CRON, async () => {
    console.log(`[cron] Starting track fetch... (${new Date().toISOString()})`);
    try {
      await runFetchTracks({ reason: 'scheduled-tracks' });
    } catch (e) {
      console.error('[cron:tracks] error:', e);
    }
  }, { timezone: TIMEZONE });
}
