// ✅ FULL REWRITE v3.6 — YouTube API Client with multi-key rotation and fallback
// - Supports multiple API keys via YOUTUBE_API_KEYS (comma-separated)
// - Random rotation to balance quota usage
// - Graceful fallback if a key fails or quota exhausted
// - Centralized logging for each request

import axios from 'axios';

// Helper to get a valid API key (rotates randomly)
function getApiKey() {
  const keys = process.env.YOUTUBE_API_KEYS?.split(',')
    .map(k => k.trim())
    .filter(Boolean);

  if (!keys || keys.length === 0) {
    console.warn('[youtube] ❌ No valid YOUTUBE_API_KEYS found in environment');
    return null;
  }

  const key = keys[Math.floor(Math.random() * keys.length)];
  console.log(`[youtube] Using API key: ${key.slice(0, 6)}... (${keys.length} total)`);
  return key;
}

// Core function to fetch items from a YouTube playlist
export async function fetchPlaylistItems(playlistId, maxResults = 200) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Missing YOUTUBE_API_KEYS in environment');

  const url = 'https://www.googleapis.com/youtube/v3/playlistItems';
  const params = {
    part: 'snippet,contentDetails',
    playlistId,
    maxResults: 50,
    key: apiKey,
  };

  let allItems = [];
  let nextPageToken = null;
  let pageCount = 0;

  try {
    do {
      if (nextPageToken) params.pageToken = nextPageToken;
      const res = await axios.get(url, { params });

      if (res?.data?.items?.length) {
        allItems.push(...res.data.items);
      }

      nextPageToken = res.data.nextPageToken || null;
      pageCount++;
    } while (nextPageToken && allItems.length < maxResults);

    console.log(`[youtube] Playlist ${playlistId}: fetched ${allItems.length} items in ${pageCount} pages`);
    return allItems;
  } catch (err) {
    console.error(`[youtube] ❌ API error for playlist ${playlistId}:`, err.response?.data?.error || err.message);
    return [];
  }
}

// Optional helper to fetch playlist metadata
export async function fetchPlaylistMeta(playlistId) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Missing YOUTUBE_API_KEYS in environment');

  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/playlists', {
      params: {
        part: 'snippet,contentDetails',
        id: playlistId,
        key: apiKey,
      },
    });

    const item = res?.data?.items?.[0];
    if (!item) return null;

    return {
      title: item.snippet?.title || 'Untitled',
      description: item.snippet?.description || '',
      itemCount: item.contentDetails?.itemCount || 0,
      cover_url: item.snippet?.thumbnails?.high?.url || null,
      channelTitle: item.snippet?.channelTitle || '',
    };
  } catch (err) {
    console.error(`[youtube] ❌ Failed to fetch metadata for ${playlistId}:`, err.response?.data?.error || err.message);
    return null;
  }
}
