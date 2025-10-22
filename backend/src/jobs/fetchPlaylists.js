// ✅ FULL REWRITE — Tier-rotated playlist fetcher with quota guard + daily logging
// - 6 ključeva po 10k QUs → koristi ~9,500 QUs/dan za plejliste (ostatak ostaje za trake)
// - TIER rotacija regiona + rotacija query-ja (teme)
// - automatski prelazi na sledeći API ključ kod 403 (quota)
// - dnevni log → tabela fetch_runs

import axios from 'axios';
import { upsertPlaylists } from '../lib/db.js';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, sleep, todayLocalISO, parseYMD, daysSince } from '../lib/utils.js';
import { pickTodayPlan } from '../lib/monthlyCycle.js';

// ───────────────────────────────────────────────────────────────────────────────
// KONFIG

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (API_KEYS.length < 1) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);

// ~9,500 QUs/dan za plejliste (Search: 100 QUs/poziv)
const MAX_DAILY_QUOTA_QUS = 9500;
const COST_PER_REQUEST_QUS = 100; // YouTube Search
const MAX_REGION_PAGES_FALLBACK = 2; // ako tier ne kaže drugačije
const DELAY_BETWEEN_PAGES_MS = 300;
const DELAY_BETWEEN_REGIONS_MS = 500;

// Kružna rotacija tema po regionu (da ne dobijamo stalno iste liste)
const QUERY_POOL = [
  'music playlist',
  'top hits',
  'best songs',
  'pop mix',
  'hip hop playlist',
  'dance hits',
  'rock classics',
  'edm mix',
  'chill music',
  'party playlist',
];

// ───────────────────────────────────────────────────────────────────────────────
// STATE

let apiCallsToday = 0;
function quotaLeftQUs() {
  return Math.max(0, MAX_DAILY_QUOTA_QUS - apiCallsToday * COST_PER_REQUEST_QUS);
}
function quotaExceeded() {
  return apiCallsToday * COST_PER_REQUEST_QUS >= MAX_DAILY_QUOTA_QUS;
}

// ───────────────────────────────────────────────────────────────────────────────
// HELPERS

function nextQueryFactory(pool) {
  let i = -1;
  const p = pool.filter(Boolean);
  return () => {
    if (!p.length) return 'music playlist';
    i = (i + 1) % p.length;
    return p[i];
  };
}

const nextQuery = nextQueryFactory(QUERY_POOL);

/**
 * Jedan API poziv (YouTube Search) sa automatskom rotacijom ključa na 403-quota.
 */
async function callYouTubeSearch(params) {
  while (true) {
    const key = nextKey();
    try {
      const url = 'https://www.googleapis.com/youtube/v3/search';
      const { data } = await axios.get(url, { params: { key, ...params } });
      apiCallsToday++; // 1 search = 100 QUs
      return data;
    } catch (e) {
      const msg = e?.response?.data?.error?.message || e.message;
      const status = e?.response?.status;
      // quota / rate rotate
      if (status === 403 && /quota/i.test(msg)) {
        console.warn('[quota] key exhausted → rotating to next key…');
        // samo nastavi krug sa sledećim ključem
        continue;
      }
      // ostali errori: propagiraj
      throw e;
    }
  }
}

/**
 * Preuzmi do `maxPages` stranica plejlista za jedan region i zadati query.
 * Ako region === 'GLOBAL', preskačemo regionCode (global search).
 */
async function fetchRegionPlaylists(regionCode, maxPages, query) {
  const all = [];
  let pageToken = null;
  let pages = 0;

  do {
    if (quotaExceeded()) {
      console.warn(`[quota] daily budget reached (${apiCallsToday * COST_PER_REQUEST_QUS} QUs).`);
      break;
    }

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

  // dedupe po external_id
  const unique = Object.values(
    all.reduce((acc, p) => {
      if (!acc[p.external_id]) acc[p.external_id] = p;
      return acc;
    }, {})
  );

  return unique;
}

// ───────────────────────────────────────────────────────────────────────────────
// MAIN

export async function runFetchPlaylists({ reason = 'manual' } = {}) {
  apiCallsToday = 0;

  // Izračun ciklus-dana (1..n) radi loga
  const startStr = process.env.CYCLE_START_DATE;
  const cycleDay = startStr ? Math.max(1, daysSince(parseYMD(startStr), new Date()) + 1) : null;

  // Plan za danas (iz monthlyCycle.js)
  const plan = pickTodayPlan(new Date()); // { steps: [{region, pages}, ...] }

  console.log(`[fetch] start: reason=${reason}`);
  console.log(`[fetch] plan regions: ${plan.steps.map(s => `${s.region}(p${s.pages})`).join(', ')}`);
  console.log(`[quota] budget today: ${MAX_DAILY_QUOTA_QUS} QUs (~${MAX_DAILY_QUOTA_QUS / COST_PER_REQUEST_QUS} calls).`);

  const sb = getSupabase();
  const startedAt = new Date().toISOString();

  const batch = [];
  const usedRegions = [];
  for (const step of plan.steps) {
    if (quotaExceeded()) break;

    const query = nextQuery();
    const rows = await fetchRegionPlaylists(step.region, step.pages, query);
    console.log(`[fetch] ${step.region}: +${rows.length} (query="${query}")`);
    batch.push(...rows);
    usedRegions.push({ region: step.region, pages: step.pages, query });

    await sleep(DELAY_BETWEEN_REGIONS_MS);

    if (quotaExceeded()) break;
  }

  // Globalni dedupe
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
    upsertedCount = count || uniqueBatch.length; // zavisi kako je implementiran upsertPlaylists
    console.log(`[fetch] upserted ${upsertedCount} unique playlists`);
  } else {
    console.log('[fetch] nothing to upsert');
  }

  // Log u fetch_runs
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

  console.log(`[fetch] total API calls: ${apiCallsToday} (${apiCallsToday * COST_PER_REQUEST_QUS} QUs) — left: ${quotaLeftQUs()} QUs`);
  console.log('[fetch] done ✅');
}
