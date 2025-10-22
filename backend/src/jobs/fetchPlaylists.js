// ✅ FULL REWRITE — Maksimalni dnevni fetch sa rotacijom ključeva i paginacijom
// ✅ FULL REWRITE — Maksimalni dnevni fetch sa pametnom rotacijom ključeva, paginacijom i auto-resetom

import axios from 'axios';
import { upsertPlaylists } from '../lib/db.js';
import { pickTodayRegions, sleep } from '../lib/utils.js';

// 🔑 Učitaj i proveri API ključeve
const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (API_KEYS.length < 1) {
  throw new Error('YOUTUBE_API_KEYS missing — add at least one key.');
}

// 📦 Aktivni ključevi (koji još nisu iscrpljeni)
let activeKeys = [...API_KEYS];
let keyIndex = 0;

/**
 * Vrati sledeći aktivni ključ (rotacija)
 */
function nextKey() {
  if (activeKeys.length === 0) throw new Error('All YouTube API keys exhausted.');
  const key = activeKeys[keyIndex % activeKeys.length];
  keyIndex = (keyIndex + 1) % activeKeys.length;
  return key;
}

/**
 * Isključi ključ ako potroši kvotu (403 quotaExceeded)
 */
function disableKey(key) {
  if (activeKeys.includes(key)) {
    activeKeys = activeKeys.filter(k => k !== key);
    console.warn(`[quota] Key disabled (quota exceeded): ${key}`);
  }
}

/**
 * Automatski reset svih ključeva svaki dan u ponoć (lokalno vreme)
 */
function scheduleKeyReset() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  const delay = nextMidnight - now;

  setTimeout(() => {
    activeKeys = [...API_KEYS];
    console.log(`[quota] Keys automatically reset at midnight ✅`);
    scheduleKeyReset(); // ponovo zakazivanje za sledeći dan
  }, delay);
}

// Pokreni reset timer odmah
scheduleKeyReset();

/**
 * 🎵 Pretraga plejlista po regionu (sa paginacijom i failover-om)
 */
async function searchPlaylistsForRegion(regionCode, q = 'music playlist') {
  let all = [];
  let pageToken = null;
  let pages = 0;

  do {
    const key = nextKey();
    try {
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

      const { data } = await axios.get(url, { params });
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

      // Kratka pauza između stranica (radi stabilnosti)
      await sleep(250);

    } catch (e) {
      const msg = e.response?.data?.error?.message || e.message;
      if (msg?.includes('quota')) {
        disableKey(key);
        console.warn(`[fetch] ${regionCode}: quota exceeded on key, switching...`);
      } else {
        console.error(`[fetch] ${regionCode} error`, msg);
      }
      break; // izađi iz do petlje ako quota blokira ključ
    }
  } while (pageToken && pages < 4 && activeKeys.length > 0);

  // 🧹 Ukloni duplikate unutar regiona
  const unique = Object.values(
    all.reduce((acc, p) => {
      if (!acc[p.external_id]) acc[p.external_id] = p;
      return acc;
    }, {})
  );

  return unique;
}

/**
 * 🚀 Glavna funkcija: dnevni FETCH
 */
export async function runFetchPlaylists({ reason = 'manual' } = {}) {
  const regions = pickTodayRegions(40); // 🌍 do 40 regiona dnevno
  console.log(`[fetch] start (${reason}) regions=${regions.join(',')}`);
  console.log(`[quota] active keys: ${activeKeys.length}/${API_KEYS.length}`);

  const batch = [];

  for (const r of regions) {
    if (activeKeys.length === 0) {
      console.warn('[fetch] all keys exhausted, stopping early ⚠️');
      break;
    }

    try {
      const rows = await searchPlaylistsForRegion(r);
      console.log(`[fetch] ${r}: +${rows.length}`);
      batch.push(...rows);
      await sleep(500); // pauza između regiona
    } catch (e) {
      console.error(`[fetch] ${r} error`, e.response?.data || e.message);
    }
  }

  if (batch.length) {
    // 💾 Siguran upsert bez duplikata
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

  console.log(`[fetch] done ✅ (keys left: ${activeKeys.length})`);
}
import axios from 'axios';
import { upsertPlaylists } from '../lib/db.js';
import { pickTodayRegions, nextKeyFactory, sleep } from '../lib/utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (API_KEYS.length < 1) {
  throw new Error('YOUTUBE_API_KEYS missing — add at least one key.');
}

const nextKey = nextKeyFactory(API_KEYS); // 🔁 round-robin rotacija API ključeva

/**
 * Fetch playlists for a given region with pagination
 * Maks. 4 stranice po regionu (≈100 rezultata)
 */
async function searchPlaylistsForRegion(regionCode, q = 'music playlist') {
  let all = [];
  let pageToken = null;
  let pages = 0;

  do {
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

    const { data } = await axios.get(url, { params });
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

    // Kratka pauza između stranica da ne udariš limit
    await sleep(250);

  } while (pageToken && pages < 4); // ⏩ max 4 stranice po regionu

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
  const regions = pickTodayRegions(40); // 🌍 40 regiona dnevno
  console.log(`[fetch] start (${reason}) regions=${regions.join(',')}`);

  const batch = [];

  for (const r of regions) {
    try {
      const rows = await searchPlaylistsForRegion(r);
      console.log(`[fetch] ${r}: +${rows.length}`);
      batch.push(...rows);

      // Pauza između regiona da izbegneš 403 rate limit
      await sleep(500);
    } catch (e) {
      console.error(`[fetch] ${r} error`, e.response?.data || e.message);
    }
  }

  if (batch.length) {
    // 🧩 Ukloni sve globalne duplikate pre upserta
    const uniqueBatch = Object.values(
      batch.reduce((acc, row) => {
        acc[row.external_id] = row;
        return acc;
      }, {})
    );

    // 💾 Siguran upsert kroz Supabase RPC (sprečava duplikate)
    const { count, error } = await upsertPlaylists(uniqueBatch);
    if (error) throw error;

    console.log(`[fetch] upserted ${count} unique playlists`);
  } else {
    console.log('[fetch] nothing to upsert');
  }

  console.log('[fetch] done ✅');
}
