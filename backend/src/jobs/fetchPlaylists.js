/**
 * Manual run (local):
 *   cd backend && cp .env.example .env && edit .env
 *   npm run jobs:fetch:once
 *   npm run jobs:refresh:once
 * Deployed (Render):
 *   BOOTSTRAP_FETCH=true triggers one-time fetch after first deploy.
 *   Cron schedule: fetch@09:05, refresh@21:05 (Europe/Budapest).
 */
import 'dotenv/config';
import axios from 'axios';
import regions from '../data/region_codes.json' with { type: 'json' };
import { upsertPlaylists } from '../lib/db.js';
import { initSupabase } from '../lib/supabase.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
let keyIndex = 0;
function nextKey() {
  if (API_KEYS.length === 0) throw new Error('Missing YOUTUBE_API_KEYS');
  keyIndex = (keyIndex + 1) % API_KEYS.length;
  return API_KEYS[keyIndex];
}

// NOTE: There is no direct "playlist.categoryId" in YouTube Data API.
// Strategy: discover candidate music playlists by query terms + channels, then (optionally) validate by sampling videos with categoryId=10.
// This keeps quotas manageable; refine later if needed.

async function searchPlaylistsForRegion(regionCode, q = 'music playlist') {
  const key = nextKey();
  const url = 'https://www.googleapis.com/youtube/v3/search';
  const params = {
    key,
    part: 'snippet',
    maxResults: 25,
    type: 'playlist',
    q,
    regionCode
  };
  const { data } = await axios.get(url, { params });
  return (data.items || []).map(it => ({
    external_id: it.id.playlistId,
    title: it.snippet?.title ?? null,
    description: it.snippet?.description ?? null,
    cover_url: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
    region: regionCode,
    category: 'Music',
    is_public: true,
    fetched_on: new Date().toISOString(),
    channelTitle: it.snippet?.channelTitle ?? null,
    language_guess: it.snippet?.defaultLanguage ?? null,
    quality_score: 0.5
  }));
}

export async function runFetchPlaylists({ reason = 'manual' } = {}) {
  console.log(`[fetch] start (${reason})`);
  const startTs = Date.now();

  const batch = [];
  // rotate 8–10 regions per day to spread quotas
  const dayIndex = Math.floor(Date.now() / (24 * 3600 * 1000));
  const sliceStart = (dayIndex % regions.length);
  const dayRegions = [];
  for (let i = 0; i < 10; i++) {
    dayRegions.push(regions[(sliceStart + i) % regions.length]);
  }

  for (const r of dayRegions) {
    try {
      const rows = await searchPlaylistsForRegion(r);
      batch.push(...rows);
      console.log(`[fetch] ${r}: ${rows.length} playlists`);
      // small throttle
      await new Promise(res => setTimeout(res, 400));
    } catch (e) {
      console.error(`[fetch] ${r} failed:`, e.response?.data || e.message);
    }
  }

  if (batch.length > 0) {
    const { count } = await upsertPlaylists(batch);
    console.log(`[fetch] upserted ${count} playlists`);
  } else {
    console.log('[fetch] nothing to upsert');
  }

  console.log(`[fetch] done in ${(Date.now() - startTs)}ms`);
}

// CLI one-off run: node src/jobs/fetchPlaylists.js --once
if (process.argv.includes('--once')) {
  (async () => {
    await initSupabase();
    await runFetchPlaylists({ reason: 'cli-once' });
  })().then(() => process.exit(0)).catch(err => {
    console.error(err); process.exit(1);
  });
}
