// ✅ FULL REWRITE — Optimized YouTube playlists fetcher (10 000/day, paginated, valid playlist IDs)
import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, pickTodayRegions, sleep } from '../lib/utils.js';

const MAX_API_CALLS_PER_DAY = 60000;       // 6 keys × 10 000 quota
const MAX_PLAYLISTS_PER_RUN = 10000;       // target daily playlists
const REGIONS_PER_DAY = 10;                // koliko regiona dnevno koristiš
const MAX_PAGES_PER_REGION = 40;           // paginacija: 40×50 = 2 000 plejlista po regionu

// 🔐 API ključevi
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
    if (region === 'CN') {
      console.warn('[playlists] skipping CN — unsupported regionCode');
      continue;
    }

    let pageToken = null;
    let pages = 0;
    console.log(`[playlists] region: ${region}`);

    do {
      if (collected.length >= MAX_PLAYLISTS_PER_RUN) break;
      if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break;

      const key = nextKey();
      const params = {
        key,
        part: 'snippet,contentDetails',
        maxResults: 50,
        regionCode: region === 'GLOBAL' ? 'US' : region, // fallback za GLOBAL feed
      };
      if (pageToken) params.pageToken = pageToken;

      try {
        const { data } = await axios.get('https://www.googleapis.com/youtube/v3/playlists', { params });
        apiCallsToday++;

        const batch = (data.items || []).map(p => ({
          external_id: p.id,
          title: p.snippet?.title ?? null,
          description: p.snippet?.description ?? null,
          cover_url: p.snippet?.thumbnails?.high?.url ?? p.snippet?.thumbnails?.default?.url ?? null,
          region,
          category: 'music',
          is_public: true,
          fetched_on: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }));

        collected.push(...batch);
        console.log(`[playlists] ${region}: +${batch.length} (page ${pages + 1})`);
        pageToken = data.nextPageToken || null;
        pages++;
        await sleep(150 + Math.random() * 100);
      } catch (e) {
        const msg = e.response?.data?.error?.message || e.message;
        console.error(`[playlists:${region}] ${msg}`);
        await sleep(400);
        break;
      }
    } while (pageToken && pages < MAX_PAGES_PER_REGION && collected.length < MAX_PLAYLISTS_PER_RUN);
  }

  // 🧹 Ukloni duplikate po external_id
  const unique = Object.values(
    collected.reduce((acc, p) => {
      if (!acc[p.external_id]) acc[p.external_id] = p;
      return acc;
    }, {})
  );

  // 💾 Upsert u bazu
  const { error } = await sb.from('playlists').upsert(unique, { onConflict: 'external_id' });
  if (error) console.error('[playlists] upsert error:', error);

  console.log(`[playlists] done ✅ total: ${unique.length} playlists, API calls: ${apiCallsToday}`);
}
