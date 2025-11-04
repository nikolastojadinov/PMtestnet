// backend/src/lib/youtube/fetchPlaylists.js
// ✅ Dedicated playlist discovery using YouTube search.list with sanitization
// - Removes invalid videoCategoryId when type='playlist' to avoid 400 INVALID_ARGUMENT
// - Keeps retry logic (region fallback, underscore sanitization) and low-yield filter

const BASE = 'https://www.googleapis.com/youtube/v3';

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
  if (regionCode === 'GLOBAL') return undefined; // skip GLOBAL for search to avoid invalids
  const rc = String(regionCode).toUpperCase();
  return rc.length === 2 ? rc : undefined;
}

async function ytGetSearch(params) {
  const attempts = Math.max(1, API_KEYS.length);
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    const key = getKey();
    // Sanitize invalid parameter for playlist type
    if (params && params.type === 'playlist' && 'videoCategoryId' in params) {
      console.warn('[youtube] ⚠️ Removing videoCategoryId from playlist search to avoid 400 error');
      delete params.videoCategoryId;
    }
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
  let retriedWithoutRegion = false;
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
      if (safeRegion) params.regionCode = safeRegion;
      const j = await ytGetSearch(params);
      items.push(...(j.items || []));
      pageToken = j.nextPageToken;
      if (!pageToken) break;
      await sleep(150);
    } catch (err) {
      const msg = String(err.message || '');
      const isGeneric400 = msg.includes(' 400:') || msg.includes('"code": 400') || msg.toLowerCase().includes('invalid_argument') || msg.toLowerCase().includes('badrequest');
      if (safeRegion && !retriedWithoutRegion && (isGeneric400 || msg.includes('invalidRegionCode') || msg.includes('regionCode parameter specifies an invalid region code'))) {
        console.warn(`[youtube] ↩️ Retrying search without regionCode. query="${query}" region="${regionCode}"`);
        safeRegion = undefined;
        retriedWithoutRegion = true;
        i--; // retry same page without region
        await sleep(120);
        continue;
      }
      if (!retriedSanitizedQuery && typeof query === 'string' && query.includes('_')) {
        const sanitized = query.replace(/_/g, ' ');
        console.warn(`[youtube] ↩️ Retrying search with sanitized query. from="${query}" to="${sanitized}"`);
        query = sanitized;
        retriedSanitizedQuery = true;
        i--; // retry with sanitized query
        await sleep(120);
        continue;
      }
      console.error('[youtube] ❌ searchPlaylists error:', msg, `query="${query}" region="${regionCode}"`);
      break;
    }
  }

  if (items.length < 10) {
    console.log('[fetch] skipped low-yield query', { query, regionCode });
    return [];
  }
  return items;
}
