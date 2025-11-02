// ✅ FULL REWRITE v3.9 — YouTube Playlist Fetcher (search.list) — 70 regions, Music-only

import fetch from 'node-fetch';
import { pickTodayRegions, nextKeyFactory, sleep, updateRegionScore } from './utils.js';

const YOUTUBE_API_KEYS = process.env.YOUTUBE_API_KEYS?.split(',').map(k => k.trim()).filter(Boolean);
const getNextApiKey = nextKeyFactory(YOUTUBE_API_KEYS);

export async function fetchYouTubePlaylists() {
  if (!YOUTUBE_API_KEYS?.length) throw new Error('No YOUTUBE_API_KEYS provided');

  const regions = pickTodayRegions(10);
  console.log(`[youtube] 🌍 Fetching playlists for regions: ${regions.join(', ')}`);

  const results = [];

  for (const region of regions) {
    const key = getNextApiKey();
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=playlist&videoCategoryId=10&regionCode=${region}&maxResults=25&key=${key}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      if (!data.items || !Array.isArray(data.items)) {
        console.warn(`[youtube] ⚠️ No playlists found for ${region}`);
        updateRegionScore(region, 0);
        continue;
      }

      const playlists = data.items.map(p => ({
        id: p.id?.playlistId || p.id,
        snippet: p.snippet,
        region
      }));

      results.push(...playlists);
      updateRegionScore(region, playlists.length);
      console.log(`[youtube] ✅ ${playlists.length} playlists fetched for ${region}`);
    } catch (err) {
      console.error(`[youtube] ❌ Error for region ${region}:`, err.message);
    }

    await sleep(1500);
  }

  console.log(`[youtube] 🎵 Total playlists fetched: ${results.length}`);
  return results;
}
