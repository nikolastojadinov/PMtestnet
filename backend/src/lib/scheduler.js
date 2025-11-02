// cleanup directive: remove outdated or conflicting scheduler logic before rewrite
import cron from 'node-cron';
import { fetchPlaylists } from '../jobs/fetchPlaylists.js';
import { cleanEmptyPlaylists } from '../jobs/cleanEmptyPlaylists.js';
import { fetchTracksFromPlaylist } from '../jobs/fetchTracksFromPlaylist.js';

// ✅ Fiksni raspored (vremena u UTC – Render koristi UTC)
export function startScheduledJobs() {
  console.log('🕒 Purple Music backend scheduler started (fixed UTC times)');

  // 09:05 → Fetch playlists
  cron.schedule('5 9 * * *', async () => {
    console.log('▶️ Running fetchPlaylists at 09:05 UTC');
    await fetchPlaylists();
  });

  // Clean empty playlists — svaki sat od 12:45 do 21:45
  const cleanHours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  cleanHours.forEach(hour => {
    cron.schedule(`45 ${hour} * * *`, async () => {
      console.log(`🧹 Running cleanEmptyPlaylists at ${hour}:45 UTC`);
      await cleanEmptyPlaylists();
    });
  });

  // Fetch tracks from playlist — od 13h do 22h (svakog sata)
  const trackHours = [13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  trackHours.forEach(hour => {
    cron.schedule(`0 ${hour} * * *`, async () => {
      console.log(`🎵 Running fetchTracksFromPlaylist at ${hour}:00 UTC`);
      await fetchTracksFromPlaylist();
    });
  });
}
