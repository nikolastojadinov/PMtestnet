// ✅ FULL REWRITE v5.1 — Unified YouTube API logic (playlist + track fetch)
// 🔹 Fix: replaced missing getNextApiKey with nextKeyFactory() generator
// 🔹 Handles key rotation, pagination, and playlist-track parsing
// 🔹 Fully compatible with Supabase + cron jobs + Render env vars

import { sleep, nextKeyFactory } from './utils.js';

// ✅ Create rotating key generator from env
const getNextApiKey = nextKeyFactory(process.env.YOUTUBE_API_KEYS.split(','));

// =========================================================
// 🧩 YouTube Core Helpers
// =========================================================

async function youtubeFetch(url, params = {}, retries = 3) {
  const apiKey = getNextApiKey();
  const fullUrl = new URL(url);
  fullUrl.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) fullUrl.searchParams.set(k, v);

  try {
    const res = await fetch(fullUrl.toString());
    if (!res.ok) {
      const text = await res.text();
      console.warn(`[youtube] ⚠️ ${res.status} ${res.statusText}: ${text}`);
      if (retries > 0) {
        await sleep(2000);
        return youtubeFetch(url, params, retries - 1);
      }
      throw new Error(`YouTube API error ${res.status}`);
    }
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('[youtube] ❌ Network/API fetch failed:', err.message);
    return null;
  }
}

// =========================================================
// 🎵 Fetch Music Playlists (categoryId = 10)
// =========================================================

export async function fetchYouTubePlaylists(region = 'US', maxResults = 50) {
  console.log('[youtube] Fetching music playlists...');

  const params = {
    part: 'snippet,contentDetails',
    chart: 'mostPopular',
    regionCode: region,
    maxResults,
    videoCategoryId: '10',
  };

  const data = await youtubeFetch('https://www.googleapis.com/youtube/v3/playlists', params);

  if (!data || !data.items) {
    console.error('[youtube] ❌ Error fetching playlists: No filter selected or empty response.');
    return [];
  }

  const playlists = data.items.map((pl) => ({
    id: pl.id,
    title: pl.snippet?.title || 'Untitled Playlist',
    description: pl.snippet?.description || '',
    thumbnails: pl.snippet?.thumbnails,
    region,
  }));

  console.log(`[youtube] ✅ Retrieved ${playlists.length} playlists for region ${region}`);
  return playlists;
}

// =========================================================
// 🎶 Fetch Tracks from a Playlist
// =========================================================

export async function fetchTracksFromPlaylist(playlistId) {
  console.log(`[youtube] Fetching tracks from playlist ${playlistId}...`);
  let allTracks = [];
  let pageToken = null;
  let fetchCount = 0;

  do {
    const params = {
      part: 'snippet,contentDetails',
      maxResults: 200,
      playlistId,
      pageToken,
    };

    const data = await youtubeFetch('https://www.googleapis.com/youtube/v3/playlistItems', params);

    if (!data || !data.items) break;

    const tracks = data.items
      .filter((item) => item.snippet?.title && item.snippet?.resourceId?.videoId)
      .map((item) => ({
        id: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        artist: item.snippet.videoOwnerChannelTitle || 'Unknown Artist',
        cover_url: item.snippet.thumbnails?.high?.url || null,
        duration: null, // optional, can be added from videos API
      }));

    allTracks = [...allTracks, ...tracks];
    pageToken = data.nextPageToken || null;
    fetchCount++;

    console.log(`[youtube] ▶️ Page ${fetchCount}: ${tracks.length} tracks`);

    if (pageToken) await sleep(1000);
  } while (pageToken && fetchCount < 5);

  console.log(`[youtube] ✅ Total ${allTracks.length} tracks fetched from playlist ${playlistId}`);
  return allTracks;
}
