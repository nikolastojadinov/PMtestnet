// ✅ FULL REWRITE — Aggressive daily fetch (target 3000 playlists)
// Rotira regione i ključne reči; koristi više API ključeva.

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, pickTodayRegions, sleep } from '../lib/utils.js';

const TARGET_PLAYLISTS_PER_DAY = 3000;
const MAX_API_CALLS_PER_DAY    = 60000;
const MAX_PAGES_PER_QUERY      = 10;
const REGIONS_PER_BATCH        = 14;

const KEYWORDS = [
  'music','best songs','playlist','top hits','mix','official',
  'pop','rock','hip hop','r&b','house','indie','edm','country',
  'latin','reggaeton','afrobeats','k-pop','j-pop','turkish','hindi',
  'movie soundtrack','party','workout','throwback','90s','2000s','2020s'
];

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');
const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

async function searchPlaylists({ region, q }) {
  const out = [];
  let pageToken = null;
  let pages = 0;

  do {
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break;
    const key = nextKey();
    const params = {
      key,
      part: 'snippet',
      type: 'playlist',
      q,
      regionCode: region !== 'GLOBAL' ? region : undefined,
      maxResults: 50,
      pageToken,
    };
    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', { params });
      apiCallsToday++;
      const batch = (data.items || []).map(it => ({
        external_id: it.id?.playlistId,
        title: it.snippet?.title ?? null,
        description: it.snippet?.description ?? null,
        cover_url: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
        region,
        category: 'music',
        is_public: true,
        fetched_on: new Date().toISOString(),
        created_at: new Date().toISOString(),
        sync_status: 'fetched',
      })).filter(r => r.external_id);
      out.push(...batch);
      pageToken = data.nextPageToken || null;
      pages++;
      await sleep(120 + Math.random() * 80);
    } catch (e) {
      console.error(`[fetchPlaylists:${region}]`, e.response?.data || e.message);
      break;
    }
  } while (pageToken && pages < MAX_PAGES_PER_QUERY);

  return out;
}

export async function runFetchPlaylists({ reason = 'daily-fetch' } = {}) {
  const sb = getSupabase();
  console.log(`[playlists] start (${reason})`);
  const regions = pickTodayRegions(REGIONS_PER_BATCH);
  const collected = [];

  regionLoop:
  for (const region of regions) {
    for (const q of KEYWORDS) {
      const batch = await searchPlaylists({ region, q });
      collected.push(...batch);
      console.log(`[playlists] +${batch.length} (total=${collected.length})`);
      if (collected.length >= TARGET_PLAYLISTS_PER_DAY) break regionLoop;
      if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break regionLoop;
      await sleep(200);
    }
  }

  const unique = Object.values(collected.reduce((acc, p) => {
    if (p.external_id && !acc[p.external_id]) acc[p.external_id] = p;
    return acc;
  }, {}));

  const { error } = await sb.from('playlists').upsert(unique, { onConflict: 'external_id' });
  if (error) console.error('[playlists] upsert error:', error);

  console.log(`[playlists] done ✅ total: ${unique.length}, API calls: ${apiCallsToday}`);
}
