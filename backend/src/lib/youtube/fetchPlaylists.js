// backend/src/lib/youtube/fetchPlaylists.js
// ✅ Definitive playlist discovery implementation using googleapis client + keyRotation
// - Strips unsupported params (regionCode, videoCategoryId) for type='playlist'
// - Balanced key rotation with per-key usage counters and quota/rate-limit handling
// - Keeps retry with sanitized query and low-yield guard intact

import { youtube, keyRotation, sleep } from '../youtube.js';
import { logQuotaError } from '../metrics.js';

// Keep the export signature used across the codebase
// Args: { query, regionCode, maxPages }
export async function searchPlaylists({ query, regionCode, maxPages = 1 }) {
  const items = [];
  let pageToken = undefined;
  let currentQuery = (typeof query === 'string' ? query.trim() : '') || 'music';
  if (currentQuery.includes('_')) currentQuery = currentQuery.replace(/_/g, ' ');

  // Defensive: track per-key usage to avoid long bursts on a single key
  const usageMap = new Map();

  for (let page = 0; page < maxPages; page++) {
    let fetchedThisPage = false;
    const attempts = Math.max(1, keyRotation.total ? keyRotation.total() : 3);

    for (let i = 0; i < attempts; i++) {
      // Build params and sanitize BEFORE key selection (we simply don't include unsupported fields)
      const params = {
        part: 'snippet',
        q: currentQuery,
        type: 'playlist',
        maxResults: 50,
        pageToken,
      };

      if (regionCode) {
        console.warn('[youtube] ⚠️ Removing regionCode + videoCategoryId from playlist search (unsupported params)');
      }

      const currentKey = keyRotation.current();
      const keyIndex = keyRotation.index();
      usageMap.set(currentKey, (usageMap.get(currentKey) || 0) + 1);
      const usageCount = usageMap.get(currentKey);
      console.log(`[key-usage] using key #${keyIndex}: ${currentKey.slice(0, 8)}..., total ${usageCount}`);

      if (usageCount > 25) {
        console.warn(`[rotation] key ${keyIndex} used 25x → rotating early`);
        keyRotation.next();
        await sleep(1500);
        continue;
      }

      try {
        const res = await youtube.search.list({
          ...params,
          auth: currentKey,
        });
        const got = res?.data?.items || [];
        items.push(...got);
        pageToken = res?.data?.nextPageToken;
        fetchedThisPage = true;
        break; // success for this page
      } catch (err) {
        const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || '';
        const msg = err?.message || JSON.stringify(err);
        console.error(`[youtube] ❌ searchPlaylists error: ${reason || 'unknown'} → ${msg}`);
        console.log(` query="${query}" region="${regionCode}"`);

        if (reason === 'quotaExceeded' || reason === 'userRateLimitExceeded') {
          try { await logQuotaError(currentKey, 'search.list', err); } catch {}
          console.warn(`[quota] key ${keyIndex} exceeded → rotating key...`);
          keyRotation.next();
          await sleep(2000);
          continue; // try next key for this page
        }

        if ((reason || '').toLowerCase().includes('bad') || (reason || '').toLowerCase().includes('invalid')) {
          if (currentQuery.includes('_')) {
            const retried = currentQuery.replace(/_/g, ' ');
            console.log(`[youtube] ↩️ Retrying search with sanitized query. from="${currentQuery}" to="${retried}"`);
            currentQuery = retried;
            await sleep(1000);
            continue;
          }
        }

        // Other errors: stop trying more keys for this page
        break;
      }
    }

    if (!fetchedThisPage) {
      console.error('[youtube] 🛑 All keys failed for this page — aborting search');
      break;
    }

    if (!pageToken) break; // end of pages
    await sleep(150); // pacing between pages
  }

  if (items.length < 10) {
    console.log('[fetch] skipped low-yield query', { query, regionCode });
    return [];
  }
  return items;
}

// backend/src/lib/youtube/fetchPlaylists.js
// ✅ Dedicated playlist discovery using YouTube search.list with strict param sanitation
// - For type='playlist', YouTube search.list does NOT support regionCode or videoCategoryId
//   We must omit them entirely to avoid 400 INVALID_ARGUMENT
// - Keeps key rotation, retry logic (query sanitization), sleep pacing, and low-yield filter

const BASE = 'https://www.googleapis.com/youtube/v3';

// Simple key rotation pool
const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let keyIdx = -1;
function getKey() {
  if (!API_KEYS.length) throw new Error('No API keys provided');
  keyIdx = (keyIdx + 1) % API_KEYS.length;
  return API_KEYS[keyIdx];
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function normalizeRegion(regionCode) {
  if (!regionCode) return undefined;
  if (regionCode === 'GLOBAL') return undefined; // Treat GLOBAL as no region
  const rc = String(regionCode).toUpperCase();
  return rc.length === 2 ? rc : undefined;
}

// Internal: perform search.list call with enforced sanitation for playlist type
async function ytGetSearch(params) {
  // Enforce param sanitation BEFORE request
  if (params && params.type === 'playlist') {
    let hadUnsupported = false;
    if ('regionCode' in params) { delete params.regionCode; hadUnsupported = true; }
    if ('videoCategoryId' in params) { delete params.videoCategoryId; hadUnsupported = true; }
    if (hadUnsupported) {
      console.warn('[youtube] ⚠️ Removing regionCode + videoCategoryId from playlist search (unsupported params)');
    }
  }

  const attempts = Math.max(1, API_KEYS.length);
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const key = getKey();
    const qp = new URLSearchParams({ ...params, key });
    const url = `${BASE}/search?${qp.toString()}`;
    const res = await fetch(url);
    if (res.ok) return res.json();
    const text = await res.text().catch(() => '');
    lastErr = new Error(`search ${res.status}: ${text}`);
    const isQuota = res.status === 403 && text && text.includes('quotaExceeded');
    if (isQuota && i < attempts - 1) { await sleep(150); continue; }
    throw lastErr;
  }
  throw lastErr || new Error('search failed: unknown error');
}

export async function searchPlaylists({ query, regionCode, maxPages = 1 }) {
  const items = [];
  let pageToken = undefined;
  let safeRegion = normalizeRegion(regionCode);
  let retriedSanitizedQuery = false;

  for (let i = 0; i < maxPages; i++) {
    try {
      const params = {
        part: 'snippet',
        type: 'playlist',
        q: (typeof query === 'string' ? query.trim() : '') || 'music',
        maxResults: 50,
        pageToken,
      };
      // Note: regionCode is intentionally not supported for playlist searches.
      // We still pass it here for internal tracking, but ytGetSearch will strip it.
      if (safeRegion) params.regionCode = safeRegion;

      const j = await ytGetSearch(params);
      items.push(...(j.items || []));
      pageToken = j.nextPageToken;
      if (!pageToken) break;
      await sleep(150);
    } catch (err) {
      const msg = String(err && err.message ? err.message : err || '');
      const isGeneric400 = msg.includes(' 400:') || msg.includes('"code": 400') || msg.toLowerCase().includes('invalid_argument') || msg.toLowerCase().includes('badrequest');

      // Region-based retries are effectively no-ops for playlist search because we strip regionCode.
      // We keep the logic here to remain consistent with previous behavior, but it won't reintroduce params.
      if (safeRegion && (isGeneric400 || msg.includes('invalidRegionCode')) ) {
        console.warn(`[youtube] ↩️ Retrying search without regionCode (playlist type ignores region). query="${query}" region="${regionCode}"`);
        safeRegion = undefined;
        i--; // retry same page
        await sleep(120);
        continue;
      }

      // Retry once with sanitized query if underscores are present
      if (!retriedSanitizedQuery && typeof query === 'string' && query.includes('_')) {
        const sanitized = query.replace(/_/g, ' ');
        console.warn(`[youtube] ↩️ Retrying search with sanitized query. from="${query}" to="${sanitized}"`);
        query = sanitized;
        retriedSanitizedQuery = true;
        i--; // retry same page with sanitized query
        await sleep(120);
        continue;
      }

      console.error('[youtube] ❌ searchPlaylists error:', msg, `query="${query}" region="${regionCode}"`);
      break;
    }
  }

  // Low-yield guard: skip if too few results to be worth persisting
  if (items.length < 10) {
    console.log('[fetch] skipped low-yield query', { query, regionCode });
    return [];
  }
  return items;
}

