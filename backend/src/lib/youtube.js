// backend/src/lib/youtube.js
// ✅ Definitive YouTube client + key rotation + helpers
// - Exports: youtube, keyRotation, sleep, searchPlaylists, fetchPlaylistItems, validatePlaylists

import { google } from 'googleapis';
import { searchPlaylists as searchPlaylistsModule } from './youtube/fetchPlaylists.js';

// Basic sleep utility (exported for convenience)
export const sleep = (ms = 1000) => new Promise((res) => setTimeout(res, ms));

// Parse API keys
const rawKeys = process.env.YOUTUBE_API_KEYS?.split(',').map(k => k.trim()).filter(Boolean) || [];
if (rawKeys.length === 0) {
  console.error('[youtube] ❌ No API keys found in YOUTUBE_API_KEYS');
  throw new Error('Missing YOUTUBE_API_KEYS in environment');
}

// Simple round-robin rotation manager
class KeyRotation {
  constructor(keys) { this.keys = keys; this.pointer = 0; }
  current() { return this.keys[this.pointer]; }
  index() { return this.pointer + 1; }
  next() { this.pointer = (this.pointer + 1) % this.keys.length; console.log(`[rotation] 🔁 Switched to key #${this.index()} (${this.current().slice(0, 8)}...)`); return this.current(); }
  reset() { this.pointer = 0; console.log('[rotation] 🔄 Reset to first key'); }
  total() { return this.keys.length; }
}

export const keyRotation = new KeyRotation(rawKeys);

export const youtube = google.youtube({ version: 'v3', auth: keyRotation.current() });
console.log(`[youtube] ✅ Initialized YouTube API client with ${keyRotation.total()} keys.`);
console.log(`[youtube] Starting from key #${keyRotation.index()} (${keyRotation.current().slice(0, 8)}...)`);

// Optional: daily reset of rotation pointer
setInterval(() => keyRotation.reset(), 24 * 60 * 60 * 1000);

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
    const attempts = Math.max(1, keyRotation.total());
    for (let attempt = 0; attempt < attempts; attempt++) {
      const key = keyRotation.current();
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
          console.warn(`[quota] playlistItems key #${keyRotation.index()} exceeded → rotating`);
          keyRotation.next();
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
    const attempts = Math.max(1, keyRotation.total());
    let ok = false;
    for (let a = 0; a < attempts; a++) {
      const key = keyRotation.current();
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
        ok = true;
        break;
      } catch (err) {
        const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || '';
        if (reason === 'quotaExceeded' || reason === 'userRateLimitExceeded') {
          console.warn(`[quota] playlists.list key #${keyRotation.index()} exceeded → rotating`);
          keyRotation.next();
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
