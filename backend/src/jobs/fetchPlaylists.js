// ✅ FULL REWRITE v4.4 — Smart Safe Fetcher (optimized quota + valid playlists)
// - Skida samo stvarne muzičke playliste
// - Preskače "Mix", "Private", "Kids", "Shorts", "Deleted", i duplikate
// - Upisuje samo ako postoje validni rezultati
// - Manji broj regiona po ciklusu (8) radi stabilnosti i štednje kvote

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, pickTodayRegions, sleep } from '../lib/utils.js';
import { pickTodayPlan } from '../lib/monthlyCycle.js';

const TARGET_PLAYLISTS_PER_DAY = 6000;
const MAX_API_CALLS_PER_DAY = 60000;
const MAX_PAGES_PER_QUERY = 10;
const REGIONS_PER_BATCH = 8; // ⬅️ smanjeno sa 24 radi uštede kvote

// 🌍 Globalni muzički keyword set (skraćen i optimizovan)
const KEYWORDS = [
  'music', 'top hits', 'pop', 'rock', 'hip hop', 'r&b', 'soul',
  'dance', 'edm', 'lofi', 'chill', 'relax', 'focus', 'study', 'jazz',
  'latin', 'reggaeton', 'afrobeats', 'k-pop', 'bollywood', 'serbian',
  '80s', '90s', '2000s', 'love songs', 'instrumental', 'party', 'workout'
];

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');
const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

// 🎯 Heuristika kvaliteta
function calcQualityScore(title, desc) {
  const len = (title?.length || 0) + (desc?.length || 0);
  return Math.min(1, Math.max(0.1, len / 300));
}

// ⚙️ Validacija — isključuje "Mix", "Shorts", "Kids", "Private", i prekratke naslove
function isValidPlaylist(id, title = '', desc = '') {
  const lower = (title + ' ' + desc).toLowerCase();

  if (
    !id ||
    id.startsWith('RD') || // Mix liste
    lower.includes('mix') ||
    lower.includes('shorts') ||
    lower.includes('kids') ||
    lower.includes('nursery') ||
    lower.includes('baby') ||
    lower.includes('cartoon') ||
    lower.includes('story for kids') ||
    lower.includes('sleep music for kids') ||
    lower.includes('private')
  ) return false;

  if (title.length < 5) return false;
  return true;
}

// 🔍 Pretraga YouTube plejlista po regionu i ključnim rečima
async function searchPlaylists({ region, q, tier, cycleDay }) {
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

      const batch = (data.items || [])
        .map(it => {
          const id = it.id?.playlistId;
          const s = it.snippet || {};
          const quality_score = calcQualityScore(s.title, s.description);

          return {
            external_id: id,
            title: s.title ?? null,
            description: s.description ?? null,
            cover_url: s.thumbnails?.high?.url ?? s.thumbnails?.default?.url ?? null,
            region,
            country: region,
            category: 'music',
            genre: q,
            keyword_used: q,
            language_guess: s.defaultLanguage ?? null,
            channel_title: s.channelTitle ?? null,
            channel_id: s.channelId ?? null,
            tier,
            fetched_cycle_day: cycleDay,
            quality_score,
            is_public: true,
            fetched_on: new Date().toISOString(),
            created_at: new Date().toISOString(),
            sync_status: 'fetched'
          };
        })
        .filter(r =>
          r.external_id &&
          r.external_id.length > 10 &&
          isValidPlaylist(r.external_id, r.title, r.description) &&
          r.quality_score >= 0.4
        );

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

// 🚀 Glavna funkcija — pokreće dnevni ciklus
export async function runFetchPlaylists({ reason = 'daily-fetch' } = {}) {
  const sb = getSupabase();
  console.log(`[playlists] start (${reason})`);

  const regions = pickTodayRegions(REGIONS_PER_BATCH);
  const plan = pickTodayPlan(new Date());
  const { currentDay, mode, steps } = plan;
  const cycleDay = mode === 'FETCH' ? currentDay : plan.targetDay;

  const collected = [];

  regionLoop:
  for (const region of regions) {
    const tier = steps?.find(s => s.region === region)?.tier || 'GLOBAL';
    for (const q of KEYWORDS) {
      const batch = await searchPlaylists({ region, q, tier, cycleDay });
      collected.push(...batch);

      console.log(`[playlists:${region}] +${batch.length} (total=${collected.length})`);

      if (collected.length >= TARGET_PLAYLISTS_PER_DAY) break regionLoop;
      if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break regionLoop;
      await sleep(150);
    }
  }

  // 🔄 Ukloni duplikate po external_id
  const unique = Object.values(collected.reduce((acc, p) => {
    if (p.external_id && !acc[p.external_id]) acc[p.external_id] = p;
    return acc;
  }, {}));

  if (unique.length > 0) {
    const { error } = await sb.from('playlists').upsert(unique, { onConflict: 'external_id' });
    if (error) console.error('[playlists] upsert error:', error);
    console.log(`[playlists] done ✅ total: ${unique.length}, API calls: ${apiCallsToday}`);
  } else {
    console.log('[playlists] ⚠️ No valid playlists found — nothing to insert');
  }
}
