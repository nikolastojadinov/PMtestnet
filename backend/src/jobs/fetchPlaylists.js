// ✅ FULL REWRITE — Stabilan dnevni fetch plejlista (50% quota usage, 6 API ključeva, rotacija, paginacija i quota guard)

import axios from 'axios';
import { upsertPlaylists } from '../lib/db.js';
import { pickTodayRegions, nextKeyFactory, sleep } from '../lib/utils.js';

// ⚙️ Podešavanja kvote i ograničenja
const MAX_QUOTA_CALLS = 30000;       // 50% od ukupne kvote (6x10.000 = 60.000 QUs)
const COST_PER_REQUEST = 100;        // 100 QUs po YouTube Search API pozivu
const MAX_REGIONS_PER_DAY = 30;      // oko 30 regiona dnevno
const MAX_PAGES_PER_REGION = 3;      // ~75 plejlista po regionu
let apiCallsToday = 0;               // brojač poziva

// 🔑 Rotacija svih aktivnih YouTube API ključeva
const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (API_KEYS.length < 1) throw new Error('YOUTUBE_API_KEYS missing.');
const nextKey = nextKeyFactory(API_KEYS);

// 🎧 Dohvata plejliste po regionu (do 3 stranice × 25 = ~75 playlisti)
async function searchPlaylistsForRegion(regionCode, q = 'music playlist') {
  let all = [];
  let pageToken = null;
  let pages = 0;

  do {
    if (apiCallsToday * COST_PER_REQUEST >= MAX_QUOTA_CALLS) {
      console.warn(`[quota] Reached playlist limit (${apiCallsToday * COST_PER_REQUEST} QUs used) — stopping.`);
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

      await sleep(250); // kratka pauza između stranica
    } catch (e) {
      if (e.response?.status === 403 && e.response?.data?.error?.message?.includes('quota')) {
        console.warn('[quota] Key exhausted — rotating...');
        continue; // koristi sledeći ključ
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

// 🚀 Glavna funkcija (pokreće se u 09:05 po lokalnom vremenu)
export async function runFetchPlaylists({ reason = 'manual' } = {}) {
  console.log(`[fetch] ▶ Start (${reason})`);
  console.log(`[quota] daily limit = ${MAX_QUOTA_CALLS} QUs (~${MAX_QUOTA_CALLS / COST_PER_REQUEST} API calls)`);
  console.log(`[quota] active keys = ${API_KEYS.length}`);
  console.log(`[fetch] mode = Playlist phase (50% quota)`);

  const regions = pickTodayRegions(MAX_REGIONS_PER_DAY);
  console.log(`[fetch] target regions: ${regions.join(', ')}`);

  const batch = [];

  for (const region of regions) {
    if (apiCallsToday * COST_PER_REQUEST >= MAX_QUOTA_CALLS) {
      console.warn(`[quota] limit reached at ${apiCallsToday} calls — stopping early.`);
      break;
    }

    try {
      const rows = await searchPlaylistsForRegion(region);
      console.log(`[fetch] ${region}: +${rows.length}`);
      batch.push(...rows);
      await sleep(400); // pauza između regiona
    } catch (e) {
      console.error(`[fetch:${region}]`, e.response?.data || e.message);
    }
  }

  // 🧩 Globalno uklanjanje duplikata
  const uniqueBatch = Object.values(
    batch.reduce((acc, row) => {
      acc[row.external_id] = row;
      return acc;
    }, {})
  );

  if (uniqueBatch.length) {
    const { count, error } = await upsertPlaylists(uniqueBatch);
    if (error) throw error;
    console.log(`[fetch] upserted ${count} unique playlists ✅`);
  } else {
    console.log('[fetch] nothing to upsert');
  }

  console.log(`[fetch] total API calls: ${apiCallsToday} (${apiCallsToday * COST_PER_REQUEST} QUs)`);
  console.log('[fetch] done ✅');
}
