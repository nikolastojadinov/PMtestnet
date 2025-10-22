// ✅ FULL REWRITE — Smart multi-tier playlist fetcher with global/regional queries & quota guard
// - koristi 6 API ključeva × 10k QUs (60k ukupno)
// - koristi ~9,500 QUs/dan za plejliste (50% dnevne kvote)
// - uključuje GLOBAL + REGIONAL + DEFAULT query poolove
// - automatska rotacija ključeva i dnevni log u Supabase

import axios from 'axios';
import { upsertPlaylists } from '../lib/db.js';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, sleep, todayLocalISO, parseYMD, daysSince } from '../lib/utils.js';
import { pickTodayPlan } from '../lib/monthlyCycle.js';

// ───────────────────────────────────────────────────────────────────────────────
// 🔧 KONFIGURACIJA

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);

// kvota — koristi 9.500 QUs (50%) dnevno
const MAX_DAILY_QUOTA_QUS = 9500;
const COST_PER_REQUEST_QUS = 100; // YouTube search
const DELAY_BETWEEN_PAGES_MS = 300;
const DELAY_BETWEEN_REGIONS_MS = 500;
const MAX_REGION_PAGES_FALLBACK = 2;

// ───────────────────────────────────────────────────────────────────────────────
// 🎧 QUERY POOLS

// GLOBAL – pretrage bez regionCode (najtraženiji worldwide)
const GLOBAL_QUERY_POOL = [
  'top hits', 'global hits', 'best songs', 'viral hits', 'chart toppers',
  'billboard hot 100', 'global top 50', 'pop hits', 'hip hop hits',
  'edm hits', 'dance hits', 'rock classics', 'throwback hits',
  'party mix', 'workout playlist', 'study music', 'chill mix'
];

// DEFAULT – generički upiti koji rade svuda
const DEFAULT_QUERY_POOL = [
  'music playlist', 'top hits', 'best songs', 'pop mix',
  'hip hop playlist', 'dance hits', 'rock classics',
  'edm mix', 'chill music', 'party playlist'
];

// REGIONAL – lokalizovani termini za specifične regione
const REGIONAL_QUERY_POOLS = {
  ES: ['reggaeton', 'musica top', 'exitos 2025', 'pop latino', 'bachata'],
  PT: ['sertanejo', 'funk carioca', 'pagode', 'samba', 'piseiro', 'forró'],
  TR: ['türkçe pop', 'şarkılar', 'rap müzik', 'en iyi şarkılar'],
  RU: ['лучшие песни', 'русский поп', 'русский рэп', 'хиты'],
  VN: ['nhạc trẻ', 'vpop', 'nhạc remix', 'nhạc EDM', 'nhạc tâm trạng'],
  PH: ['opm hits', 'pinoy top hits', 'tagalog songs'],
  KR: ['k-pop hits', 'kpop playlist', 'k-hip hop', 'k-indie'],
  JP: ['j-pop hits', 'vocaloid', 'anisong', 'city pop'],
  RS: ['narodna muzika', 'balkan hits', 'ex yu rock', 'zabavna muzika'],
  IN: ['bollywood hits', 'hindi songs', 'punjabi hits', 'indian pop'],
  ID: ['dangdut', 'indonesia hits', 'musik pop indonesia'],
  TH: ['thai pop', 'เพลงไทย', 'เพลงลูกทุ่ง', 'เพลงฮิต'],
  NG: ['afrobeats', 'naija hits', 'afropop', 'lagos vibes']
};

// rotatori query-ja
function nextQueryFactory(pool) {
  let i = -1;
  const p = pool.filter(Boolean);
  return () => {
    if (!p.length) return 'music playlist';
    i = (i + 1) % p.length;
    return p[i];
  };
}

const nextGlobalQuery = nextQueryFactory(GLOBAL_QUERY_POOL);
const nextDefaultQuery = nextQueryFactory(DEFAULT_QUERY_POOL);

function getRegionalQuery(region) {
  const pool = REGIONAL_QUERY_POOLS[region];
  if (!pool) return nextDefaultQuery();
  const fn = nextQueryFactory(pool);
  return fn();
}

// ───────────────────────────────────────────────────────────────────────────────
// 🧮 STATE

let apiCallsToday = 0;
function quotaLeftQUs() {
  return Math.max(0, MAX_DAILY_QUOTA_QUS - apiCallsToday * COST_PER_REQUEST_QUS);
}
function quotaExceeded() {
  return apiCallsToday * COST_PER_REQUEST_QUS >= MAX_DAILY_QUOTA_QUS;
}

// ───────────────────────────────────────────────────────────────────────────────
// 🔁 FETCH FUNKCIJE

async function callYouTubeSearch(params) {
  while (true) {
    const key = nextKey();
    try {
      const url = 'https://www.googleapis.com/youtube/v3/search';
      const { data } = await axios.get(url, { params: { key, ...params } });
      apiCallsToday++;
      return data;
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e.message;
      const status = e?.response?.status;
      if (status === 403 && /quota/i.test(msg)) {
        console.warn('[quota] key exhausted → rotating...');
        continue;
      }
      throw e;
    }
  }
}

async function fetchRegionPlaylists(regionCode, maxPages, query) {
  const all = [];
  let pageToken = null;
  let pages = 0;

  do {
    if (quotaExceeded()) break;

    const baseParams = {
      part: 'snippet',
      maxResults: 25,
      type: 'playlist',
      q: query,
    };

    const params = regionCode === 'GLOBAL'
      ? { ...baseParams, pageToken }
      : { ...baseParams, regionCode, pageToken };

    try {
      const data = await callYouTubeSearch(params);
      const items = (data.items || []).map(it => ({
        external_id: it.id?.playlistId,
        title: it.snippet?.title ?? null,
        description: it.snippet?.description ?? null,
        cover_url:
          it.snippet?.thumbnails?.high?.url ??
          it.snippet?.thumbnails?.default?.url ??
          null,
        region: regionCode === 'GLOBAL' ? null : regionCode,
        category: 'Music',
        is_public: true,
        fetched_on: new Date().toISOString(),
        channel_title: it.snippet?.channelTitle ?? null,
        language_guess: it.snippet?.defaultLanguage ?? null,
        quality_score: 0.5,
      })).filter(x => !!x.external_id);

      all.push(...items);
      pageToken = data.nextPageToken || null;
      pages++;

      await sleep(DELAY_BETWEEN_PAGES_MS);
    } catch (e) {
      console.error(`[fetch:${regionCode}]`, e.response?.data || e.message);
      break;
    }
  } while (pageToken && pages < (maxPages || MAX_REGION_PAGES_FALLBACK));

  // dedupe
  const unique = Object.values(
    all.reduce((acc, p) => {
      if (!acc[p.external_id]) acc[p.external_id] = p;
      return acc;
    }, {})
  );
  return unique;
}

// ───────────────────────────────────────────────────────────────────────────────
// 🚀 MAIN ENTRY

export async function runFetchPlaylists({ reason = 'manual' } = {}) {
  apiCallsToday = 0;
  const startStr = process.env.CYCLE_START_DATE;
  const cycleDay = startStr ? Math.max(1, daysSince(parseYMD(startStr), new Date()) + 1) : null;

  const plan = pickTodayPlan(new Date()); // { steps: [{region, pages}] }

  console.log(`[fetch] start (${reason}) — ${plan.steps.length} regions`);
  console.log(`[quota] daily budget ${MAX_DAILY_QUOTA_QUS} QUs (~${MAX_DAILY_QUOTA_QUS / COST_PER_REQUEST_QUS} API calls)`);

  const sb = getSupabase();
  const startedAt = new Date().toISOString();
  const batch = [];
  const usedRegions = [];

  for (const step of plan.steps) {
    if (quotaExceeded()) break;

    // izaberi query po regionu
    let query;
    if (step.region === 'GLOBAL') query = nextGlobalQuery();
    else query = getRegionalQuery(step.region);

    const rows = await fetchRegionPlaylists(step.region, step.pages, query);
    console.log(`[fetch] ${step.region}: +${rows.length} (${query})`);
    batch.push(...rows);
    usedRegions.push({ region: step.region, pages: step.pages, query });

    await sleep(DELAY_BETWEEN_REGIONS_MS);
    if (quotaExceeded()) break;
  }

  const uniqueBatch = Object.values(
    batch.reduce((acc, row) => {
      acc[row.external_id] = row;
      return acc;
    }, {})
  );

  let upsertedCount = 0;
  if (uniqueBatch.length) {
    const { count, error } = await upsertPlaylists(uniqueBatch);
    if (error) throw error;
    upsertedCount = count || uniqueBatch.length;
    console.log(`[fetch] upserted ${upsertedCount} unique playlists`);
  } else {
    console.log('[fetch] nothing to upsert');
  }

  // log u fetch_runs
  const finishedAt = new Date().toISOString();
  try {
    await sb.from('fetch_runs').insert({
      started_at: startedAt,
      finished_at: finishedAt,
      regions: usedRegions,
      playlists_count: upsertedCount,
      api_calls: apiCallsToday,
      quota_used: apiCallsToday * COST_PER_REQUEST_QUS,
      cycle_day: cycleDay,
      success: true,
    });
  } catch (e) {
    console.error('[fetch] failed to log fetch_runs:', e.message);
  }

  console.log(`[fetch] total API calls: ${apiCallsToday} (${apiCallsToday * COST_PER_REQUEST_QUS} QUs used, left ${quotaLeftQUs()} QUs)`);
  console.log('[fetch] done ✅');
}
