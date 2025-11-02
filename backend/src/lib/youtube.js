// backend/src/lib/youtube.js
// ✅ YouTube helpers — exports used od strane jobs/*
// - fetchRegionPlaylists(regions)
// - fetchPlaylistItems(playlistId, apiKeyOpt)

import { sleep, nextKeyFactory } from './utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const nextKey = nextKeyFactory(API_KEYS);

const BASE = 'https://www.googleapis.com/youtube/v3';

// Generic GET
async function ytGet(endpoint, params) {
  const key = nextKey();
  const qp = new URLSearchParams({ ...params, key });
  const url = `${BASE}/${endpoint}?${qp.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${endpoint} ${res.status}: ${text}`);
  }
  return res.json();
}

// 🔎 Fetch playlists per region (music topic)
export async function fetchRegionPlaylists(regions) {
  const all = [];
  const terms = ['music', 'hits', 'charts', 'mix', 'songs', 'popular', 'top', 'new music', 'latest', 'favorites'];
  for (const region of regions) {
    let regionBatch = [];
    try {
      const j = await ytGet('search', {
        part: 'snippet',
        type: 'playlist',
        maxResults: 50,
        regionCode: region === 'GLOBAL' ? 'US' : region,
        topicId: '/m/04rlf',
        relevanceLanguage: 'en'
      });
      regionBatch = (j.items || []).map(it => ({
        id: it?.id?.playlistId,
        snippet: it?.snippet,
        region
      }));
      if (regionBatch.length === 0) {
        for (const t of terms) {
          const sj = await ytGet('search', {
            part: 'snippet',
            type: 'playlist',
            maxResults: 50,
            regionCode: region === 'GLOBAL' ? 'US' : region,
            q: t
          });
          const extra = (sj.items || []).map(it => ({
            id: it?.id?.playlistId,
            snippet: it?.snippet,
            region
          }));
          regionBatch.push(...extra);
          if (regionBatch.length >= 50) break;
          await sleep(150);
        }
      }
      console.log(`[youtube] ✅ ${region}: ${regionBatch.length} playlists`);
      all.push(...regionBatch);
      await sleep(200);
    } catch (e) {
      console.log(`[youtube] ⚠️ Region ${region} error: ${e.message}`);
    }
  }
  console.log(`[youtube] 🎵 Total playlists fetched: ${all.length}`);
  return all;
}

// 📄 Fetch playlist items — up to 500 songs per playlist
export async function fetchPlaylistItems(playlistId, maxPages = 10) {
  let pageToken = undefined;
  const items = [];
  for (let i = 0; i < maxPages; i++) {
    try {
      const j = await ytGet('playlistItems', {
        part: 'snippet,contentDetails',
        maxResults: 50,
        playlistId,
        pageToken
      });
      items.push(...(j.items || []));
      pageToken = j.nextPageToken;
      if (!pageToken) break;
      await sleep(150);
    } catch (err) {
      if (err.message.includes('invalidPageToken')) {
        console.log(`[youtube] ⚠️ Invalid pageToken for ${playlistId} — resetting pagination`);
        break; // prekid ciklusa za ovu playlistu
      } else {
        console.log(`[youtube] ⚠️ Playlist ${playlistId} error: ${err.message}`);
        break;
      }
    }
  }
  return items.slice(0, 500);
}
