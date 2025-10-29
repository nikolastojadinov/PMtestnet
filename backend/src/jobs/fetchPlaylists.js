// ✅ FULL REWRITE v4.3 — Intelligent global playlist fetcher (quality validated)
// Dodato: automatski preskače nevalidne i prazne playliste (Mix, Private, For Kids, kratki naslovi)
// Cilj: preuzimati samo realne muzičke playliste sa kvalitetnim metapodacima

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, pickTodayRegions, sleep } from '../lib/utils.js';
import { pickTodayPlan } from '../lib/monthlyCycle.js';

const TARGET_PLAYLISTS_PER_DAY = 8000;
const MAX_API_CALLS_PER_DAY    = 90000;
const MAX_PAGES_PER_QUERY      = 12;
const REGIONS_PER_BATCH        = 24;

// 🎧 Globalni muzički keyword set (v4.2)
const KEYWORDS = [
  'music', 'best songs', 'playlist', 'top hits', 'mix', 'official', 'new songs', 'charts', 'latest songs',
  'pop', 'rock', 'hip hop', 'r&b', 'soul', 'funk', 'house', 'deep house', 'techno', 'trance', 'edm', 'indie',
  'alternative', 'punk', 'metal', 'country', 'folk', 'blues', 'jazz', 'classical', 'orchestra', 'reggae', 'ska',
  'latin', 'reggaeton', 'afrobeats', 'k-pop', 'j-pop', 'c-pop', 'turkish', 'hindi', 'bollywood', 'arabic',
  'balkan', 'serbian', 'greek', 'chill', 'relax', 'sleep', 'study', 'focus', 'background music', 'lofi',
  'ambient', 'instrumental', 'romantic', 'love songs', 'sad songs', 'happy songs', 'motivational', 'dance',
  'party', 'workout', 'gym', 'running', 'driving', 'travel', 'road trip', 'coffee shop', 'meditation', 'yoga',
  'vibes', 'deep focus', 'throwback', 'oldies', '70s', '80s', '90s', '2000s', '2010s', '2020s', 'movie soundtrack',
  'anime songs', 'game soundtrack', 'tv series', 'hollywood songs', 'disney songs', 'film score', 'cinematic music',
  'indian songs', 'korean hits', 'japanese songs', 'vietnamese music', 'filipino songs', 'nigerian hits',
  'brazilian music', 'mexican songs', 'russian songs', 'french songs', 'spanish hits', 'italian hits',
  'german music', 'thai songs', 'indonesian music', 'malay songs', 'vietnam hits', 'usa top songs'
];

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');
const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

/**
 * 🎯 Heuristika kvaliteta
 * (dužina naslova + opis → skala 0.1–1.0)
 */
function calcQualityScore(title, desc) {
  const len = (title?.length || 0) + (desc?.length || 0);
  return Math.min(1, Math.max(0.1, len / 300));
}

/**
 * 🧠 Validacija kvaliteta plejlista
 * - preskače “Mix”, “Shorts”, “Kids”, “Private”, i one sa prekratkim naslovom
 */
function isValidPlaylist(title = '', desc = '') {
  const lower = (title + ' ' + desc).toLowerCase();

  // ❌ Nevalidne reči u nazivu
  if (
    lower.includes('mix') ||
    lower.includes('shorts') ||
    lower.includes('kids') ||
    lower.includes('nursery') ||
    lower.includes('baby') ||
    lower.includes('cartoon') ||
    lower.includes('story for kids') ||
    lower.includes('sleep music for kids')
  ) return false;

  // ❌ Naslov prekratak
  if (title.length < 5) return false;

  // ✅ Prolazi filter
  return true;
}

/**
 * 🔍 Pretraga YouTube plejlista po regionu i ključnim rečima
 */
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
          const s = it.snippet || {};
          const quality_score = calcQualityScore(s.title, s.description);
          return {
            external_id: it.id?.playlistId,
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
        .filter(r => r.external_id && isValidPlaylist(r.title, r.description) && r.quality_score >= 0.4);

      out.push(...batch);
      pageToken = data.nextPageToken || null;
      pages++;

      await sleep(90 + Math.random() * 50);
    } catch (e) {
      console.error(`[fetchPlaylists:${region}]`, e.response?.data || e.message);
      break;
    }
  } while (pageToken && pages < MAX_PAGES_PER_QUERY);

  return out;
}

/**
 * 🚀 Glavna funkcija — pokreće dnevni ciklus
 */
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

  const { error } = await sb.from('playlists').upsert(unique, { onConflict: 'external_id' });
  if (error) console.error('[playlists] upsert error:', error);

  console.log(`[playlists] done ✅ total: ${unique.length}, API calls: ${apiCallsToday}`);
}
