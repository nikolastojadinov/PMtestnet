// ✅ FULL REWRITE v3.7 — YouTube API integration

import { google } from 'googleapis';

// Unified API keys: YOUTUBE_API_KEYS=key1,key2,... (legacy YOUTUBE_API_KEY supported as fallback)
const rawKeys = process.env.YOUTUBE_API_KEYS || process.env.YOUTUBE_API_KEY || '';
const API_KEYS = String(rawKeys)
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (API_KEYS.length === 0) {
  console.error('[youtube] ❌ Missing YOUTUBE_API_KEYS (or YOUTUBE_API_KEY) in environment');
}

let keyIndex = 0;
export function getNextApiKey() {
  if (API_KEYS.length === 0) return undefined;
  const key = API_KEYS[keyIndex];
  keyIndex = (keyIndex + 1) % API_KEYS.length;
  return key;
}

// Note: we omit global auth so we can rotate keys per request
const youtube = google.youtube({ version: 'v3' });

/**
 * ✅ Fetch public music playlists from YouTube (categoryId = 10)
 */
export async function fetchYouTubePlaylists() {
  console.log('[youtube] Fetching music playlists...');

  try {
    const res = await youtube.playlists.list({
      auth: getNextApiKey(),
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
      auth: getNextApiKey(),
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
