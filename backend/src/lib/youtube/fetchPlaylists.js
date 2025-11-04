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

