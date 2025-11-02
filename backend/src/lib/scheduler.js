// cleanup directive: full rewrite of this file before applying changes

import cron from 'node-cron';
import { cleanEmptyPlaylists } from './cleanEmptyPlaylists.js';
import { fetchTracksFromPlaylist } from './fetchTracksFromPlaylist.js';
import { fetchYouTubePlaylists } from './youtube.js';
import { keepAlive } from './utils.js';

/**
 * Purple Music Scheduler
 * 09:05 → fetch new playlists from YouTube
 * 12:45–21:45 → cleanEmptyPlaylists every hour
 * 13:00–22:00 → fetchTracksFromPlaylist every hour
 */
export function initScheduler() {
  console.log('[scheduler] 🕓 Scheduler initialized.');

  // 🟣 09:05 → Fetch fresh playlists from YouTube (once per day)
  cron.schedule('5 9 * * *', async () => {
    console.log('[scheduler] 🎬 Running daily fetchYouTubePlaylists...');
    try {
      await fetchYouTubePlaylists();
      console.log('[scheduler] ✅ Daily playlist fetch completed.');
    } catch (err) {
      console.error('[scheduler] ❌ Error in fetchYouTubePlaylists:', err);
    }
  });

  // 🟣 12:45–21:45 → cleanEmptyPlaylists every hour
  cron.schedule('45 12-21 * * *', async () => {
    console.log('[scheduler] 🧹 Running hourly cleanEmptyPlaylists...');
    try {
      globalThis.pendingPlaylists = await cleanEmptyPlaylists();
      console.log(`[scheduler] 🧾 Stored ${globalThis.pendingPlaylists?.length || 0} empty playlists for next fetch.`);
    } catch (err) {
      console.error('[scheduler] ❌ Error in cleanEmptyPlaylists phase:', err);
    }
  });

  // 🟣 13:00–22:00 → fetchTracksFromPlaylist every hour
  cron.schedule('0 13-22 * * *', async () => {
    console.log('[scheduler] 🎧 Running hourly fetchTracksFromPlaylist...');
    const playlists = globalThis.pendingPlaylists || [];
    if (playlists.length === 0) {
      console.warn('[scheduler] ⚠️ No pending playlists available, skipping fetch.');
      return;
    }

    try {
      await fetchTracksFromPlaylist(playlists);
      console.log('[scheduler] ✅ Hourly track fetching completed.');
    } catch (err) {
      console.error('[scheduler] ❌ Error during fetchTracksFromPlaylist:', err);
    }
  });

  // 🩵 Keepalive ping (every 5 minutes)
  cron.schedule('*/5 * * * *', async () => {
    await keepAlive();
  });
}
