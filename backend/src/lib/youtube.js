// backend/src/lib/youtube.js
// ✅ YouTube helpers — quota-aware with key pools and caching
// - fetchRegionPlaylists(regions)
// - fetchPlaylistItems(playlistId, apiKeyOpt)
// - searchPlaylists({ query, regionCode, maxPages })

import { sleep } from './utils.js';

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

// === Playlist search with improved key rotation and quota handling ===
// Notes:
// - Sanitize unsupported params (regionCode, videoCategoryId) BEFORE key selection
// - Maintain round-robin across active keys; rotate on quotaExceeded/userRateLimitExceeded
// - Short delay between rotations; cap attempts to avoid infinite loops
// - Keep low-yield logic (return [] if < 10 items)
export async function searchPlaylists({ query, regionCode, maxPages = 1 }) {
  const pool = (SEARCH_KEYS.length ? SEARCH_KEYS : ALL_KEYS);
  if (!pool.length) throw new Error('No API keys provided.');

  const items = [];
  let pageToken = undefined;
  let retriedSanitizedQuery = false;

  // Per-key usage count (resets per invocation)
  const usageCount = new Map();

  const baseQuery = (typeof query === 'string' ? query.trim() : '') || 'music';
  let currentQuery = baseQuery;
  if (regionCode) {
    // Informative log: we will strip unsupported params for playlist search
    console.warn('[youtube] ⚠️ Removing regionCode + videoCategoryId from playlist search (unsupported params)');
  }

  for (let page = 0; page < maxPages; page++) {
    // Try up to pool.length different keys for this page before aborting
    let pageFetched = false;
    for (let attempt = 0; attempt < pool.length; attempt++) {
      // Build params and sanitize BEFORE selecting key
      const params = {
        part: 'snippet',
        type: 'playlist',
        q: currentQuery,
        maxResults: 50,
        pageToken,
      };
      // Explicitly do not include regionCode/videoCategoryId for playlist searches
      // (sanitized already by not setting them)

      // Select key using round-robin across active keys
      const key = getSearchKey();
      const keyIndex = (SEARCH_KEYS.length ? SEARCH_KEYS : ALL_KEYS).indexOf(key);
      const hash = (key || '').slice(0, 8);
      usageCount.set(key, (usageCount.get(key) || 0) + 1);
      const use = usageCount.get(key);
      console.log(`[key-usage] using key ${keyIndex} (${hash}...) → total ${use}`);

      // Early rotate if same key used too often in a row (defensive)
      if (use > 25) {
        console.warn(`[rotation] key ${keyIndex} used 25x → rotating early`);
        // move to next key and retry
        await sleep(1500);
        continue;
      }

      try {
        const qp = new URLSearchParams({ ...params, key });
        const url = `${BASE}/search?${qp.toString()}`;
        const res = await fetch(url);
        if (res.ok) {
          const j = await res.json();
          const got = j.items || [];
          items.push(...got);
          pageToken = j.nextPageToken;
          pageFetched = true;
          // success resets quota error streak for this key
          markSuccess(key);
          break; // break attempt loop, continue to next page
        }

        const text = await res.text().catch(() => '');
        const isQuota = res.status === 403 && text && (text.includes('quotaExceeded') || text.includes('userRateLimitExceeded'));
        if (isQuota) {
          console.warn(`[quota] key ${keyIndex} exceeded, rotating...`);
          markQuotaError(key);
          await sleep(2000);
          continue; // try next key
        }

        // Handle 400 invalid argument/bad request: optional query sanitization
        const is400 = res.status === 400 && (text.toLowerCase().includes('invalid') || text.toLowerCase().includes('bad'));
        if (is400 && !retriedSanitizedQuery && currentQuery.includes('_')) {
          const sanitized = currentQuery.replace(/_/g, ' ');
          console.warn(`[youtube] ↩️ Retrying search with sanitized query. from="${currentQuery}" to="${sanitized}"`);
          // mutate baseQuery-like variable by shadowing in params next loop
          // quick sleep to respect pacing
          await sleep(1000);
          // Update for subsequent attempts/pages
          currentQuery = sanitized;
          retriedSanitizedQuery = true;
          continue; // re-attempt with same key rotation flow
        }

        // Other errors: log and stop trying further keys for this page
        console.error('[youtube] ❌ searchPlaylists error:', `${res.status}: ${text}`);
        break;
      } catch (err) {
        const msg = String(err?.message || err || '');
        console.error('[youtube] ❌ searchPlaylists fetch error:', msg);
        break;
      }
    }

    if (!pageFetched) {
      // All keys failed for this page; abort to avoid infinite loops
      console.error('[youtube] 🛑 All keys failed for this page — aborting search');
      break;
    }

    if (!pageToken) break; // no more pages
    await sleep(150); // pacing between pages
  }

  if (items.length < 10) {
    console.log('[fetch] skipped low-yield query', { query, regionCode });
    return [];
  }
  return items;
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
