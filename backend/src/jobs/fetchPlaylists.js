// ✅ FULL REWRITE v5.4 — Smart Fetcher with Region Learning
// 🔹 Radi SAMO tokom FETCH faze (29 dana)
// 🔹 Preskače prazne, mix, kids, private, deleted plejliste
// 🔹 Dodaje GLOBAL region svaki drugi dan
// 🔹 Uči koji region daje dobre rezultate (updateRegionScore)
// 🔹 Kompatibilno sa 6 API ključeva (60 000 kvote/dan)

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, pickTodayRegions, sleep, updateRegionScore } from '../lib/utils.js';
import { pickTodayPlan } from '../lib/monthlyCycle.js';

const TARGET_PLAYLISTS_PER_DAY = 6000;
const MAX_API_CALLS_PER_DAY = 60000;
const MAX_PAGES_PER_QUERY = 10;
const REGIONS_PER_BATCH = 8;

const KEYWORDS = [
  'music','top hits','pop','rock','hip hop','r&b','soul',
  'dance','edm','lofi','chill','relax','focus','study','jazz',
  'latin','reggaeton','afrobeats','k-pop','bollywood','serbian',
  '80s','90s','2000s','love songs','instrumental','party','workout'
];

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');
const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

// 🎯 Validacija kvaliteta
function isValidPlaylist(id, title = '', desc = '') {
  const lower = (title + ' ' + desc).toLowerCase();
  if (
    !id || id.startsWith('RD') ||
    lower.includes('mix') || lower.includes('shorts') ||
    lower.includes('kids') || lower.includes('nursery') ||
    lower.includes('baby') || lower.includes('cartoon') ||
    lower.includes('story for kids') || lower.includes('private') ||
    lower.includes('deleted') || lower.includes('unavailable')
  ) return false;
  if (title.length < 5) return false;
  return true;
}

// 🔍 Pretraga playlisti
async function searchPlaylists({ region, q }) {
  const out = [];
  let pageToken = null;
  let pages = 0;
  do {
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break;
    const key = nextKey();
    const params = { key, part: 'snippet', type: 'playlist', q, regionCode: region, maxResults: 50, pageToken };
    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', { params });
      apiCallsToday++;
      const batch = (data.items || [])
        .map(it => ({
          external_id: it.id?.playlistId,
          title: it.snippet?.title ?? null,
          description: it.snippet?.description ?? null,
          cover_url: it.snippet?.thumbnails?.high?.url ?? null,
          region,
          category: 'music',
          keyword_used: q,
          is_public: true,
          fetched_on: new Date().toISOString(),
          created_at: new Date().toISOString(),
          sync_status: 'fetched'
        }))
        .filter(r => isValidPlaylist(r.external_id, r.title, r.description));
      out.push(...batch);
      pageToken = data.nextPageToken || null;
      pages++;
      await sleep(100 + Math.random() * 80);
    } catch (e) {
      console.error(`[fetchPlaylists:${region}]`, e.response?.data || e.message);
      break;
    }
  } while (pageToken && pages < MAX_PAGES_PER_QUERY);
  return out;
}

// 🚀 Glavna funkcija
export async function runFetchPlaylists() {
  const sb = getSupabase();
  const plan = await pickTodayPlan(new Date());
  if (plan.mode === 'REFRESH') {
    console.log('[playlists] REFRESH mode active → skipping fetch');
    return;
  }

  const regions = pickTodayRegions(REGIONS_PER_BATCH);
  if (plan.currentDay % 2 === 0 && !regions.includes('GLOBAL')) regions.push('GLOBAL');
  const collected = [];

  console.log(`[playlists] start (FETCH day ${plan.currentDay})`);
  for (const region of regions) {
    for (const q of KEYWORDS) {
      const batch = await searchPlaylists({ region, q });
      updateRegionScore(region, batch.length); // 🧠 NOVO: pamćenje uspešnosti
      collected.push(...batch);
      console.log(`[playlists:${region}] +${batch.length} (total=${collected.length})`);
      if (collected.length >= TARGET_PLAYLISTS_PER_DAY) break;
      await sleep(150);
    }
  }

  const unique = Object.values(collected.reduce((a, p) => {
    if (p.external_id && !a[p.external_id]) a[p.external_id] = p;
    return a;
  }, {}));

  if (unique.length > 0) {
    const { error } = await sb.from('playlists').upsert(unique, { onConflict: 'external_id' });
    if (error) console.error('[playlists] upsert error:', error);
    console.log(`[playlists] done ✅ total: ${unique.length}, API calls: ${apiCallsToday}`);
  } else {
    console.log('[playlists] ⚠️ No valid playlists found');
  }
}
