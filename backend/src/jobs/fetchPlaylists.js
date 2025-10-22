// ✅ FULL REWRITE — Maksimalni dnevni fetch sa rotacijom ključeva, paginacijom i quota guardom (60%)

import axios from 'axios';
import { upsertPlaylists } from '../lib/db.js';
import { pickTodayRegions, nextKeyFactory, sleep } from '../lib/utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (API_KEYS.length < 1) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS); // 🔁 rotacija API ključeva

// 🎯 Konstante
const MAX_REGIONS_PER_DAY = 30;   // koliko regiona dnevno
const MAX_PAGES_PER_REGION = 3;   // max 3 stranice po regionu (≈75 playlisti po regionu)
const MAX_QUOTA_CALLS = 18000;    // 60% od ukupnih 30.000 quota units
const COST_PER_REQUEST = 100;     // 100 units po API pozivu (YouTube Search: 100 QUs)

let apiCallsToday = 0; // brojač poziva

async function searchPlaylistsForRegion(regionCode, q = 'music playlist') {
  let all = [];
  let pageToken = null;
  let pages = 0;

  do {
    if (apiCallsToday * COST_PER_REQUEST >= MAX_QUOTA_CALLS) {
      console.warn(`[quota] limit reached (${apiCallsToday * COST_PER_REQUEST} QUs used) — stopping early`);
      break;
    }

    const key = nextKey();
    const url = 'https://www.googleapis.com/youtube/v3/search';
    const params = {
      key,
      part: 'snippet',
      maxResults: 25,
      type: 'playlist',
      q,
      regionCode,
      pageToken,
    };

    try {
      const { data } = await axios.get(url, { params });
      apiCallsToday++;

      const items = (data.items || []).map(it => ({
        external_id: it.id?.playlistId,
        title: it.snippet?.title ?? null,
        description: it.snippet?.description ?? null,
        cover_url:
          it.snippet?.thumbnails?.high?.url ??
          it.snippet?.thumbnails?.default?.url ??
          null,
        region: regionCode,
        category: 'Music',
        is_public: true,
        fetched_on: new Date().toISOString(),
        channel_title: it.snippet?.channelTitle ?? null,
        language_guess: it.snippet?.defaultLanguage ?? null,
        quality_score: 0.5,
      })).filter(r => !!r.external_id);

      all.push(...items);
      pageToken = data.nextPageToken || null;
      pages++;

      await sleep(300); // mala pauza između stranica
    } catch (e) {
      if (e.response?.status === 403 && e.response?.data?.error?.message?.includes('quota')) {
        console.warn(`[quota] key exhausted — switching...`);
        continue;
      } else {
        console.error(`[fetch:${regionCode}]`, e.response?.data || e.message);
        break;
      }
    }
  } while (pageToken && pages < MAX_PAGES_PER_REGION);

  // 🧹 Ukloni duplikate unutar regiona
  const unique = Object.values(
    all.reduce((acc, p) => {
      if (!acc[p.external_id]) acc[p.external_id] = p;
      return acc;
    }, {})
  );

  return unique;
}

export async function runFetchPlaylists({ reason = 'manual' } = {}) {
  const regions = pickTodayRegions(MAX_REGIONS_PER_DAY);
  console.log(`[fetch] start (${reason}) regions=${regions.join(',')}`);
  console.log(`[quota] daily limit set to ${MAX_QUOTA_CALLS} QUs (≈${MAX_QUOTA_CALLS / COST_PER_REQUEST} API calls)`);

  const batch = [];

  for (const r of regions) {
    if (apiCallsToday * COST_PER_REQUEST >= MAX_QUOTA_CALLS) {
      console.warn(`[quota] global limit reached (${apiCallsToday} calls) — ending fetch early.`);
      break;
    }

    try {
      const rows = await searchPlaylistsForRegion(r);
      console.log(`[fetch] ${r}: +${rows.length}`);
      batch.push(...rows);

      await sleep(500); // mala pauza između regiona
    } catch (e) {
      console.error(`[fetch:${r}]`, e.response?.data || e.message);
    }
  }

  if (batch.length) {
    const uniqueBatch = Object.values(
      batch.reduce((acc, row) => {
        acc[row.external_id] = row;
        return acc;
      }, {})
    );

    const { count, error } = await upsertPlaylists(uniqueBatch);
    if (error) throw error;
    console.log(`[fetch] upserted ${count} unique playlists`);
  } else {
    console.log('[fetch] nothing to upsert');
  }

  console.log(`[fetch] total API calls: ${apiCallsToday} (${apiCallsToday * COST_PER_REQUEST} QUs)`);
  console.log('[fetch] done ✅');
}
