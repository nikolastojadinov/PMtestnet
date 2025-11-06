// backend/src/lib/youtube/fetchPlaylists.js
// ✅ Definitive playlist discovery implementation using googleapis client + keyRotation
// - Strips unsupported params (regionCode, videoCategoryId) for type='playlist'
// - Balanced key rotation with per-key usage counters and quota/rate-limit handling
// - Keeps retry with sanitized query and low-yield guard intact

import { youtube, keyPool, sleep } from '../youtube.js';
import { logQuotaError, logApiUsage } from '../metrics.js';

// Keep the export signature used across the codebase
// Args: { query, regionCode, maxPages }
export async function searchPlaylists({ query, regionCode, maxPages = 1 }) {
  const items = [];
  let pageToken = undefined;
  let currentQuery = (typeof query === 'string' ? query.trim() : '') || 'music';
  if (currentQuery.includes('_')) currentQuery = currentQuery.replace(/_/g, ' ');

  // Stats for this run
  const localStats = { pages: 0 };

  for (let page = 0; page < maxPages; page++) {
    let fetchedThisPage = false;
  const attempts = Math.max(1, keyPool.size ? keyPool.size() : 3);

    for (let i = 0; i < attempts; i++) {
      // Build params and sanitize BEFORE key selection (we simply don't include unsupported fields)
      const params = {
        part: 'snippet',
        q: currentQuery,
        type: 'playlist',
        maxResults: 50,
        pageToken,
      };

      // Silent sanitization: regionCode and videoCategoryId are unsupported for type='playlist'.
      // We intentionally do not include them in params and avoid log spam here.

      const keyObj = await keyPool.selectKey('search.list');
      const currentKey = keyObj.key;

      try {
        const res = await youtube.search.list({
          ...params,
          auth: currentKey,
        });
        const got = res?.data?.items || [];
        items.push(...got);
        pageToken = res?.data?.nextPageToken;
        fetchedThisPage = true;
        keyPool.markUsage(currentKey, 'search.list', true);
        try { await logApiUsage({ apiKey: currentKey, endpoint: 'search.list', quotaCost: 100, status: 'ok' }); } catch {}
        break; // success for this page
      } catch (err) {
        const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || '';
        const msg = err?.message || JSON.stringify(err);
        console.error(`[youtube] ❌ searchPlaylists error: ${reason || 'unknown'} → ${msg}`);
        console.log(` query="${query}" region="${regionCode}"`);

        if (reason === 'quotaExceeded' || reason === 'userRateLimitExceeded') {
          try { await logQuotaError(currentKey, 'search.list', err); } catch {}
          console.warn(`[quota] key ${String(currentKey).slice(0,8)} exceeded → cooldown`);
          keyPool.setCooldown(currentKey, 60);
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

