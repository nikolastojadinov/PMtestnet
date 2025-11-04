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

