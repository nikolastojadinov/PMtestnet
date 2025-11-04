// backend/src/lib/youtube.js
// ✅ YouTube helpers — quota-aware with key pools and caching
// - fetchRegionPlaylists(regions)
// - fetchPlaylistItems(playlistId, apiKeyOpt)
// - searchPlaylists({ query, regionCode, maxPages })

import { sleep } from './utils.js';
import { searchPlaylists } from './youtube/fetchPlaylists.js';

const ALL_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Split key pools: half for search/playlists, half for playlistItems
const half = Math.max(1, Math.floor(ALL_KEYS.length / 2));
const SEARCH_KEYS = ALL_KEYS.slice(0, half);
const TRACK_KEYS = ALL_KEYS.slice(half) .length ? ALL_KEYS.slice(half) : ALL_KEYS.slice(0, 1);

// Quota tracking per key — if quotaExceeded 3x in a row, mark inactive for the day
let quotaState = { date: new Date().toDateString(), keys: {} };
function ensureQuotaState() {
  const today = new Date().toDateString();
  if (quotaState.date !== today) {
    quotaState = { date: today, keys: {} };
  }
}
function markQuotaError(key) {
  ensureQuotaState();
  const k = quotaState.keys[key] || { inactive: false, consecutive: 0 };
  k.consecutive += 1;
  if (k.consecutive >= 3) k.inactive = true;
  quotaState.keys[key] = k;
}
function markSuccess(key) {
  ensureQuotaState();
  const k = quotaState.keys[key] || { inactive: false, consecutive: 0 };
  k.consecutive = 0;
  quotaState.keys[key] = k;
}
function isActive(key) {
  ensureQuotaState();
  return !(quotaState.keys[key]?.inactive);
}

let idxSearch = -1;
let idxTrack = -1;
function getSearchKey() {
  const pool = SEARCH_KEYS.length ? SEARCH_KEYS : ALL_KEYS;
  if (!pool.length) throw new Error('No API keys provided.');
  for (let tries = 0; tries < pool.length; tries++) {
    idxSearch = (idxSearch + 1) % pool.length;
    const key = pool[idxSearch];
    if (isActive(key)) return key;
  }
  // All inactive: reactivate lightly (soft reset) to avoid full outage next day
  quotaState.keys = Object.fromEntries(Object.entries(quotaState.keys).map(([k, v]) => [k, { ...v, inactive: false }]));
  idxSearch = (idxSearch + 1) % pool.length;
  const key = pool[idxSearch];
  console.warn('[quota] All search keys inactive — soft reset for the day');
  console.log('[quota] active key set (search)');
  return key;
}
function getTrackKey() {
  const pool = TRACK_KEYS.length ? TRACK_KEYS : ALL_KEYS;
  if (!pool.length) throw new Error('No API keys provided.');
  for (let tries = 0; tries < pool.length; tries++) {
    idxTrack = (idxTrack + 1) % pool.length;
    const key = pool[idxTrack];
    if (isActive(key)) return key;
  }
  quotaState.keys = Object.fromEntries(Object.entries(quotaState.keys).map(([k, v]) => [k, { ...v, inactive: false }]));
  idxTrack = (idxTrack + 1) % pool.length;
  const key = pool[idxTrack];
  console.warn('[quota] All track keys inactive — soft reset for the day');
  console.log('[quota] active key set (track)');
  return key;
}

const BASE = 'https://www.googleapis.com/youtube/v3';

// Generic GET with API key rotation and quota retry
async function ytGet(endpoint, params, keyType = 'search') {
  const poolSize = keyType === 'track' ? Math.max(1, (TRACK_KEYS.length || ALL_KEYS.length)) : Math.max(1, (SEARCH_KEYS.length || ALL_KEYS.length));
  const attempts = Math.max(1, poolSize);
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const key = keyType === 'track' ? getTrackKey() : getSearchKey();
    const qp = new URLSearchParams({ ...params, key });
    const url = `${BASE}/${endpoint}?${qp.toString()}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      markSuccess(key);
      return json;
    }
    const text = await res.text().catch(() => '');
    lastErr = new Error(`${endpoint} ${res.status}: ${text}`);
    const isQuota = res.status === 403 && text && text.includes('quotaExceeded');
    if (isQuota && i < attempts - 1) {
      markQuotaError(key);
      // Try next key after a short backoff
      await sleep(150);
      continue;
    }
    // For other errors or last attempt, throw immediately
    throw lastErr;
  }
  // Exhausted all keys with quota errors
  throw lastErr || new Error('YouTube request failed: unknown error');
}

function normalizeRegion(regionCode) {
  if (!regionCode) return undefined;
  if (regionCode === 'GLOBAL') return undefined; // remove GLOBAL queries from API
  const rc = String(regionCode).toUpperCase();
  // Only accept 2-letter ISO codes; otherwise omit to avoid INVALID_ARGUMENT
  return rc.length === 2 ? rc : undefined;
}

// 🔎 Fetch playlists per region (music topic)
export async function fetchRegionPlaylists(regions) {
  const all = [];
  const terms = ['music', 'hits', 'charts', 'mix', 'songs', 'popular', 'top', 'new music', 'latest', 'favorites'];
  for (const region of regions) {
    let regionBatch = [];
    try {
      const j = await ytGet('search', {
        part: 'snippet',
        type: 'playlist',
        maxResults: 50,
        // regionCode: skip GLOBAL, allow undefined
        regionCode: normalizeRegion(region),
        topicId: '/m/04rlf',
        relevanceLanguage: 'en'
      }, 'search');
      regionBatch = (j.items || []).map(it => ({
        id: it?.id?.playlistId,
        snippet: it?.snippet,
        region
      }));
      if (regionBatch.length === 0) {
        for (const t of terms) {
          const sj = await ytGet('search', {
            part: 'snippet',
            type: 'playlist',
            maxResults: 50,
            regionCode: normalizeRegion(region),
            q: t
          }, 'search');
          const extra = (sj.items || []).map(it => ({
            id: it?.id?.playlistId,
            snippet: it?.snippet,
            region
          }));
          regionBatch.push(...extra);
          if (regionBatch.length >= 50) break;
          await sleep(150);
        }
      }
      console.log(`[youtube] ✅ ${region}: ${regionBatch.length} playlists`);
      all.push(...regionBatch);
      await sleep(150);
    } catch (e) {
      console.log(`[youtube] ⚠️ Region ${region} error: ${e.message}`);
    }
  }
  console.log(`[youtube] 🎵 Total playlists fetched: ${all.length}`);
  return all;
}

// 📄 Fetch playlist items — up to 500 songs per playlist
// In-memory per-day cache for playlist items
let playlistCache = { date: new Date().toDateString(), map: new Map() };
function ensureCacheDay() {
  const today = new Date().toDateString();
  if (playlistCache.date !== today) {
    playlistCache = { date: today, map: new Map() };
  }
}

export async function fetchPlaylistItems(playlistId, maxPages = 1) {
  ensureCacheDay();
  if (playlistCache.map.has(playlistId)) {
    console.log('[cache] hit playlistItems', playlistId);
    return playlistCache.map.get(playlistId);
  }
  let pageToken = undefined;
  const items = [];
  for (let i = 0; i < maxPages; i++) {
    try {
      const j = await ytGet('playlistItems', {
        part: 'snippet,contentDetails',
        maxResults: 50,
        playlistId,
        pageToken
      }, 'track');
      items.push(...(j.items || []));
      pageToken = j.nextPageToken;
      if (!pageToken) break;
      await sleep(150);
    } catch (err) {
      if (err.message.includes('invalidPageToken')) {
        console.log(`[youtube] ⚠️ Invalid pageToken for ${playlistId} — resetting pagination`);
        break; // prekid ciklusa za ovu playlistu
      } else {
        console.log(`[youtube] ⚠️ Playlist ${playlistId} error: ${err.message}`);
        break;
      }
    }
  }
  // Store in daily cache
  playlistCache.map.set(playlistId, items.slice(0, 500));
  return items.slice(0, 500);
}

// Search playlists by query and region using search.list
// Re-export searchPlaylists from the dedicated module for playlist discovery
export { searchPlaylists };

// Validate playlists via playlists.list to get privacy and itemCount
export async function validatePlaylists(externalIds = []) {
  const out = [];
  for (let i = 0; i < externalIds.length; i += 50) {
    const batch = externalIds.slice(i, i + 50);
    try {
      const j = await ytGet('playlists', {
        part: 'status,contentDetails,snippet',
        id: batch.join(','),
        maxResults: 50,
      }, 'search');
      const items = j.items || [];
      for (const it of items) {
        out.push({
          external_id: it.id,
          is_public: it.status?.privacyStatus === 'public',
          item_count: it.contentDetails?.itemCount ?? null,
          etag: it.etag || null,
          title: it.snippet?.title,
        });
      }
    } catch (err) {
      console.error('[youtube] ❌ validatePlaylists error:', err.message);
    }
  }
  return out;
}

// Expose key getters for logging/tests
export { getSearchKey, getTrackKey };
