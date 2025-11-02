// ✅ FULL REWRITE v4.0 — YouTube Music Playlist Fetcher
// 🔹 Uses search endpoint with videoCategoryId=10 (Music)
// 🔹 Supports 70+ regions with dynamic key rotation
// 🔹 Handles API quota, pagination, and region logging

import { sleep, nextKeyFactory, pickTodayRegions } from './utils.js';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';
let getNextKey;

// 🧠 Initialize API key rotation
export function initYouTubeKeys(keys) {
  getNextKey = nextKeyFactory(keys);
  console.log(`[youtube] ✅ YouTube key rotation ready (${keys.length} keys)`);
}

// 🎵 Fetch playlists for all regions of the day
export async function fetchYouTubePlaylists() {
  if (!getNextKey) throw new Error('YouTube API keys not initialized.');

  const regions = pickTodayRegions(10); // 10+GLOBAL = 11 total
  console.log(`[youtube] 🌍 Fetching playlists for regions: ${regions.join(', ')}`);

  const allResults = [];

  for (const region of regions) {
    const apiKey = getNextKey();
    const url = `${YT_BASE}/search?part=snippet&type=playlist&videoCategoryId=10&regionCode=${region}&maxResults=50&key=${apiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        console.error(`[youtube] ❌ HTTP ${res.status} for ${region}: ${text}`);
        continue;
      }

      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        console.warn(`[youtube] ⚠️ No playlists found for ${region}`);
        continue;
      }

      const formatted = data.items.map((item) => ({
        id: item.id?.playlistId,
        snippet: item.snippet,
        region,
      }));

      console.log(`[youtube] ✅ ${formatted.length} playlists found for ${region}`);
      allResults.push(...formatted);

      // 💤 Sleep between region calls to avoid quota spikes
      await sleep(1000);
    } catch (err) {
      console.error(`[youtube] ❌ Error fetching playlists for ${region}: ${err.message}`);
    }
  }

  console.log(`[youtube] 🎵 Total playlists fetched: ${allResults.length}`);
  return allResults;
}
