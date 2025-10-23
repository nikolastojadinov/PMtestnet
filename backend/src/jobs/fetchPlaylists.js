// ✅ FULL REWRITE — Optimized YouTube playlists fetcher (10 000/day)
import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, pickTodayRegions, sleep } from '../lib/utils.js';

const MAX_API_CALLS_PER_DAY = 60000;       // 6 keys × 10 000 quota
const MAX_PLAYLISTS_PER_RUN = 10000;       // daily playlists
const MAX_RESULTS_PER_REGION = 500;        // per region batch
const REGIONS_PER_DAY = 10;

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);
if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

export async function runFetchPlaylists({ reason = 'daily-playlists' } = {}) {
  const sb = getSupabase();
  console.log(`[playlists] start (${reason})`);

  const regions = pickTodayRegions(REGIONS_PER_DAY);
  const collected = [];

  for (const region of regions) {
    if (collected.length >= MAX_PLAYLISTS_PER_RUN) break;

    const key = nextKey();
    const params = {
      key,
      part: 'snippet,contentDetails',
      chart: 'mostPopular',
      regionCode: region,
      maxResults: 50,
      videoCategoryId: 10, // Music
    };

    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/videos', { params });
      apiCallsToday++;

      const batch = (data.items || []).map(v => ({
        external_id: v.id,
        title: v.snippet?.title ?? null,
        description: v.snippet?.description ?? null,
        cover_url: v.snippet?.thumbnails?.high?.url ?? v.snippet?.thumbnails?.default?.url ?? null,
        region,
        category: 'music',
        is_public: true,
        fetched_on: new Date().toISOString(),
        created_at: new Date().toISOString(),
        sync_status: 'fetched',
      }));

      collected.push(...batch);
      console.log(`[playlists] ${region}: +${batch.length} items`);
      await sleep(150);
    } catch (e) {
      console.error(`[playlists:${region}]`, e.response?.data || e.message);
      await sleep(500);
    }
  }

  const unique = Object.values(collected.reduce((acc, p) => {
    if (!acc[p.external_id]) acc[p.external_id] = p;
    return acc;
  }, {}));

  const { error } = await sb.from('playlists').upsert(unique, { onConflict: 'external_id' });
  if (error) console.error('[playlists] upsert error:', error);

  console.log(`[playlists] done ✅ total: ${unique.length} (API calls: ${apiCallsToday})`);
}
