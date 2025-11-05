// backend/src/lib/youtube.js
// ✅ Definitive YouTube client + key rotation + helpers
// - Exports: youtube, keyRotation, sleep, searchPlaylists, fetchPlaylistItems, validatePlaylists

import { google } from 'googleapis';
import { searchPlaylists as searchPlaylistsModule } from './youtube/fetchPlaylists.js';
import { KeyPool, COST_TABLE } from './keyPool.js';

// Basic sleep utility (exported for convenience)
export const sleep = (ms = 1000) => new Promise((res) => setTimeout(res, ms));

// Parse API keys
const rawKeys = process.env.YOUTUBE_API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || [];
if (rawKeys.length === 0) {
  console.error('[youtube] ❌ No API keys found in YOUTUBE_API_KEYS');
  throw new Error('Missing YOUTUBE_API_KEYS in environment');
}

// Proportional key pool (replaces simple round-robin)
export const keyPool = new KeyPool(rawKeys, { dailyLimit: 10000 });

export const youtube = google.youtube({ version: 'v3', auth: rawKeys[0] });
console.log(`[youtube] ✅ Initialized YouTube API client with ${keyPool.size()} keys.`);

// Optional: midnight daily reset of usage (scheduler also triggers at 09:05)
setInterval(() => keyPool.resetDaily(), 24 * 60 * 60 * 1000);

// Re-export definitive playlist discovery implementation
export const searchPlaylists = searchPlaylistsModule;

// 🔎 Fetch playlists per region (music topic)
// Legacy fetchRegionPlaylists removed (not used)

// 📄 Fetch playlist items — limit to 200 songs per playlist
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
  const LIMIT = 200; // songs per playlist cap
  let pageToken = undefined;
  const items = [];
  for (let page = 0; page < maxPages; page++) {
    let fetched = false;
    const attempts = Math.max(1, keyPool.size());
    for (let attempt = 0; attempt < attempts; attempt++) {
      const keyObj = await keyPool.selectKey('playlistItems.list');
      const key = keyObj.key;
      try {
        const res = await youtube.playlistItems.list({
          part: 'snippet,contentDetails',
          maxResults: 50,
          playlistId,
          pageToken,
          auth: key,
        });
        const j = res?.data || {};
        items.push(...(j.items || []));
        keyPool.markUsage(key, 'playlistItems.list', true);
        try { /* light metrics */ } catch {}
        if (items.length >= LIMIT) {
          // truncate and stop further paging
          fetched = true;
          pageToken = undefined;
          break;
        }
        pageToken = j.nextPageToken;
        fetched = true;
        break;
      } catch (err) {
        const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || '';
        if (reason === 'quotaExceeded' || reason === 'userRateLimitExceeded') {
          console.warn(`[quota] playlistItems key ${String(key).slice(0,8)} exceeded → cooldown`);
          keyPool.setCooldown(key, 60);
          await sleep(1000);
          continue;
        }
        const msg = err?.message || String(err);
        if ((msg || '').includes('invalidPageToken')) {
          console.log(`[youtube] ⚠️ Invalid pageToken for ${playlistId} — resetting pagination`);
        } else {
          console.log(`[youtube] ⚠️ Playlist ${playlistId} error: ${msg}`);
        }
        fetched = false;
        break;
      }
    }
    if (!fetched) break;
    if (!pageToken) break;
    await sleep(150);
  }
  const out = items.slice(0, LIMIT);
  playlistCache.map.set(playlistId, out);
  return out;
}

// Validate playlists via playlists.list to get privacy and itemCount
export async function validatePlaylists(externalIds = []) {
  const out = [];
  for (let i = 0; i < externalIds.length; i += 50) {
    const batch = externalIds.slice(i, i + 50);
    const attempts = Math.max(1, keyPool.size());
    let ok = false;
    for (let a = 0; a < attempts; a++) {
      const keyObj = await keyPool.selectKey('playlists.list');
      const key = keyObj.key;
      try {
        const res = await youtube.playlists.list({
          part: 'status,contentDetails,snippet',
          id: batch.join(','),
          maxResults: 50,
          auth: key,
        });
        const items = res?.data?.items || [];
        for (const it of items) {
          out.push({
            external_id: it.id,
            is_public: it.status?.privacyStatus === 'public',
            item_count: it.contentDetails?.itemCount ?? null,
            etag: it.etag || null,
            title: it.snippet?.title,
          });
        }
        keyPool.markUsage(key, 'playlists.list', true);
        try { /* optional light metric hook */ } catch {}
        ok = true;
        break;
      } catch (err) {
        const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || '';
        if (reason === 'quotaExceeded' || reason === 'userRateLimitExceeded') {
          console.warn(`[quota] playlists.list key ${String(key).slice(0,8)} exceeded → cooldown`);
          keyPool.setCooldown(key, 60);
          await sleep(1000);
          continue;
        }
        console.error('[youtube] ❌ validatePlaylists error:', err?.message || String(err));
        break;
      }
    }
    if (!ok) {
      console.warn('[youtube] ⚠️ validatePlaylists chunk failed after key rotations');
    }
    await sleep(120);
  }
  return out;
}

// Keep default export for compatibility
export default youtube;
