// ✅ FULL REWRITE — Target 3,000 playlists/day (aggressive, region+keywords rotation)
// Korišćenje YouTube Search API (type=playlist) sa rotacijom regiona i ključnih reči.

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, pickTodayRegions, sleep } from '../lib/utils.js';

const TARGET_PLAYLISTS_PER_DAY = 3000;
const MAX_API_CALLS_PER_DAY    = 60000;   // zbirno preko ključeva
const MAX_PAGES_PER_QUERY      = 10;      // svaka strana = do 50 rezultata
const REGIONS_PER_BATCH        = 14;      // više regiona po danu da stignemo target

// Razne muzičke ključne reči (rotacija da bi izbegli identične rezultate)
const KEYWORDS = [
  'music', 'best songs', 'top hits', 'playlist', 'mix', 'official',
  'pop', 'rock', 'hip hop', 'rap', 'r&b', 'electronic', 'house',
  'edm', 'indie', 'country', 'latin', 'reggaeton', 'afrobeats',
  'k-pop', 'j-pop', 'turkish', 'arabic', 'hindi', 'punjabi',
  'soundtrack', 'movie songs', 'gaming music', 'workout music',
  'party mix', 'throwback', '90s', '2000s', '2020s'
];

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
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
      relevanceLanguage: undefined
    };

    if (pageToken) params.pageToken = pageToken;

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
  } while (pageToken && pages < MAX_PAGES_PER_QUERY);

  return out;
}

export async function runFetchPlaylists({ reason = 'daily-fetch' } = {}) {
  const sb = getSupabase();
  console.log(`[playlists] start (${reason})`);

  const regions = pickTodayRegions(REGIONS_PER_BATCH);
  const collected = [];
  let kwIndex = 0;

  // Glavna rotacija: region × keyword dok ne pređemo 3000 ili potrošimo kvotu
  regionLoop:
  for (const region of regions) {
    for (let i = 0; i < KEYWORDS.length; i++) {
      const q = KEYWORDS[(kwIndex + i) % KEYWORDS.length];
      console.log(`[playlists] search: region=${region} q="${q}"`);
      try {
        const batch = await searchPlaylists({ region, q });
        collected.push(...batch);
        console.log(`[playlists] +${batch.length} (total=${collected.length})`);
      } catch (e) {
        console.error('[playlists] search error:', e.response?.data || e.message);
      }
      if (collected.length >= TARGET_PLAYLISTS_PER_DAY) break regionLoop;
      if (apiCallsToday >= MAX_API_CALLS_PER_DAY) {
        console.warn('[playlists] API quota reached, stopping.');
        break regionLoop;
      }
      await sleep(150);
    }
    kwIndex = (kwIndex + 7) % KEYWORDS.length; // pomeri mix kjučeva po regionu
  }

  // 🧹 dedupe po external_id
  const unique = Object.values(collected.reduce((acc, p) => {
    if (p.external_id && !acc[p.external_id]) acc[p.external_id] = p;
    return acc;
  }, {}));

  // 💾 Upsert u Supabase
  const { error } = await sb.from('playlists').upsert(unique, { onConflict: 'external_id' });
  if (error) console.error('[playlists] upsert error:', error);

  console.log(`[playlists] done ✅ total: ${unique.length} playlists, API calls: ${apiCallsToday}`);
}
