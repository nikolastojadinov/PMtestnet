// ✅ FULL REWRITE v3.7 — YouTube API integration

import { google } from 'googleapis';

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY
});

/**
 * ✅ Fetch public music playlists from YouTube (categoryId = 10)
 */
export async function fetchYouTubePlaylists() {
  console.log('[youtube] Fetching music playlists...');

  try {
    const res = await youtube.playlists.list({
      part: ['snippet', 'contentDetails'],
      chart: 'mostPopular',
      maxResults: 25,
      regionCode: 'US'
    });

    const playlists = res.data.items || [];
    console.log(`[youtube] ✅ Retrieved ${playlists.length} playlists`);
    return playlists;
  } catch (err) {
    console.error('[youtube] ❌ Error fetching playlists:', err.message);
    return [];
  }
}

/**
 * ✅ Fetch all tracks from a playlist
 */
export async function fetchPlaylistItems(playlistId) {
  console.log(`[youtube] Fetching items for playlist: ${playlistId}`);

  try {
    const res = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId,
      maxResults: 50
    });

    return res.data.items || [];
  } catch (err) {
    console.error(`[youtube] ❌ Error fetching tracks for ${playlistId}:`, err.message);
    return [];
  }
}
