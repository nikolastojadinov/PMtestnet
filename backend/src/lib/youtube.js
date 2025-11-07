// backend/src/lib/youtube.js
// ✅ Definitive YouTube client + key rotation + helpers
// - Exports: youtube, keyRotation, sleep, searchPlaylists, fetchPlaylistItems, validatePlaylists

import { google } from 'googleapis';
import { KeyPool, COST_TABLE } from './keyPool.js';
import { getDaySlotSeeds, pickDaySlotList } from './searchSeedsGenerator.js';
import { supabase } from './supabase.js';
import { logApiUsage } from './metrics.js';
import { setJobCursor } from './persistence.js';

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

// Discovery now based on pre-generated seeds; provide stub accessor
export function searchPlaylists({ day, slot } = {}) {
  const now = new Date();
  const cycleStart = process.env.CYCLE_START_DATE || '2025-10-27';
  const dayIndex = computeCycleDay(now, cycleStart);
  const useDay = day || dayIndex;
  if (typeof slot === 'number') return { day: useDay, slot, queries: pickDaySlotList(useDay, slot) };
  return { day: useDay, slots: Array.from({ length: 20 }, (_, s) => pickDaySlotList(useDay, s)) };
}

function computeCycleDay(now = new Date(), start = '2025-10-27') {
  const [y,m,d] = start.split('-').map(Number);
  const s = new Date(y,(m||1)-1,d||1);
  const diffDays = Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()) - Date.UTC(s.getFullYear(),s.getMonth(),s.getDate()))/(24*3600*1000));
  return ((diffDays % 29)+29)%29 + 1;
}

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

// -----------------------------
// Seed discovery implementation
// -----------------------------

function isoNow() {
  return new Date().toISOString();
}

// Safe batch size for Supabase IN() queries against large ID arrays
const BATCH_SIZE = 200;

function mapSearchItemToRaw(it, tags) {
  return {
    external_id: it.id?.playlistId,
    title: it.snippet?.title || null,
    description: it.snippet?.description || null,
    channel_id: it.snippet?.channelId || null,
    channel_title: it.snippet?.channelTitle || null,
    region: tags?.region || null,
    category: tags?.category || null,
  thumbnail_url: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
  fetched_on: isoNow(),
    validated: false,
    cycle_mode: 'SEEDS',
  };
}

async function insertChunks(table, rows, chunkSize = 500) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).insert(chunk);
    if (!error) inserted += chunk.length; else console.warn(`[seeds] ⚠️ insert ${table} chunk failed:`, error.message);
  }
  return inserted;
}

// New upsert-based raw playlist writer with duplicate + permission handling
// Requirements:
//  - Use ON CONFLICT (external_id) DO UPDATE (mutable columns only)
//  - Count duplicates (existing rows) and treat updates as successful
//  - Gracefully handle missing/forbidden category_log (warning, non-fatal)
//  - Return count of inserted/updated rows and duplicate count
async function insertPlaylistsRaw(rawRows) {
  if (!rawRows?.length) return { upserted: 0, duplicates: 0, categoryLogWarnings: 0 };

  // Ensure we only operate on rows with external_id
  const rows = rawRows.filter(r => r.external_id);
  if (!rows.length) return { upserted: 0, duplicates: 0, categoryLogWarnings: 0 };

  // Fetch existing external_ids to identify duplicates prior to write (batched to avoid 414 errors)
  const ids = rows.map(r => r.external_id);
  const existingSet = new Set();
  try {
    const totalBatches = Math.ceil(ids.length / BATCH_SIZE) || 1;
    for (let i = 0, batchNo = 1; i < ids.length; i += BATCH_SIZE, batchNo++) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('playlists_raw')
        .select('external_id')
        .in('external_id', chunk);
      if (!error && data) {
        for (const row of data) existingSet.add(row.external_id);
      } else if (error) {
        console.warn('[seeds] ⚠️ unable to check existing playlists_raw batch:', error.message);
      }
      // Progress + throttle to stay within rate limits
      console.log(`[seeds] 🟢 batch ${batchNo}/${totalBatches} checked (${chunk.length} ids)`);
      await sleep(300);
    }
  } catch (e) {
    console.warn('[seeds] ⚠️ exception checking existing playlists_raw (batched):', e.message || String(e));
  }

  const newRows = [];
  const updateRows = []; // only mutable columns
  for (const r of rows) {
    if (existingSet.has(r.external_id)) {
      updateRows.push({
        external_id: r.external_id,
        title: r.title,
        description: r.description,
        region: r.region,
        channel_title: r.channel_title,
        item_count: r.item_count ?? null,
        // viewCount + last_refreshed_on not present in playlists_raw schema; skip safely
      });
    } else {
      newRows.push(r);
    }
  }

  // Insert new rows via upsert (conflict unlikely as they are filtered)
  let insertedCount = 0;
  if (newRows.length) {
    const { error: insError } = await supabase
      .from('playlists_raw')
      .upsert(newRows, { onConflict: 'external_id' });
    if (insError) {
      console.warn('[seeds] ⚠️ upsert new playlists_raw failed:', insError.message);
    } else {
      insertedCount += newRows.length;
    }
  }

  // Perform updates in chunks (Supabase updates can't batch different values with one call unless we send each row; we chunk individually for efficiency)
  let updatedCount = 0;
  const CHUNK = 500;
  for (let i = 0; i < updateRows.length; i += CHUNK) {
    const slice = updateRows.slice(i, i + CHUNK);
    // We can't send varying column values with a single update call by filter list; resort to per-row updates.
    // To reduce network overhead, attempt bulk upsert again (will update all provided columns only) using same mechanism.
    const { error: updError } = await supabase
      .from('playlists_raw')
      .upsert(slice, { onConflict: 'external_id' });
    if (updError) {
      console.warn('[seeds] ⚠️ playlists_raw update chunk failed:', updError.message);
    } else {
      updatedCount += slice.length;
    }
  }

  // Optional category_log permission probe
  let categoryLogWarnings = 0;
  try {
    const { error: catErr } = await supabase.from('category_log').select('id').limit(1);
    if (catErr) {
      categoryLogWarnings += 1;
      if (/permission|denied|not exist/i.test(catErr.message)) {
        console.warn('[seeds] ⚠️ category_log permission denied — continuing');
      } else {
        console.warn('[seeds] ⚠️ category_log inaccessible — continuing:', catErr.message);
      }
    }
  } catch (e) {
    categoryLogWarnings += 1;
    console.warn('[seeds] ⚠️ category_log probe exception — continuing:', e.message || String(e));
  }

  return {
    upserted: insertedCount + updatedCount,
    duplicates: existingSet.size,
    categoryLogWarnings,
  };
}

async function upsertPlaylists(rows) {
  if (!rows.length) return 0;
  const { error } = await supabase
    .from('playlists')
    .upsert(rows, { onConflict: 'external_id' });
  if (error) console.warn('[seeds] ⚠️ upsert playlists failed:', error.message);
  return rows.length;
}

// Track writing removed for metadata-only seed discovery mode.

/**
 * Run discovery for a given day/slot using pre-generated search seeds.
 * - Uses search.list (type=playlist) for each seed query (maxResults=50)
 * - Validates public playlists via playlists.list
 * - Inserts into playlists_raw; promotes into playlists; optionally stores tracks
 * - Writes job_cursor when completed
 */
export async function runSeedDiscovery(day, slot) {
  const seeds = getDaySlotSeeds(day, slot);
  console.log(`[seedDiscovery] 🟣 Starting slot ${slot} (day=${day}, TZ=${process.env.TZ||'Europe/Budapest'})`);
  const seenIds = new Set();
  const rawRows = [];
  const apiKeyCount = keyPool.size();
  let apiCalls = 0;

  for (const seed of seeds) {
    const q = seed.query;
    let lastErr = null;
    // rotate across keys on failure
    for (let attempt = 0; attempt < Math.max(1, apiKeyCount); attempt++) {
      const keyObj = await keyPool.selectKey('search.list');
      const key = keyObj.key;
      try {
        const res = await youtube.search.list({
          part: 'snippet',
          type: 'playlist',
          q,
          maxResults: 50,
          auth: key,
        });
        apiCalls++;
        keyPool.markUsage(key, 'search.list', true);
        await logApiUsage({ apiKey: key, endpoint: 'search.list', quotaCost: 100, status: 'ok' });
        const items = res?.data?.items || [];
        for (const it of items) {
          const pid = it.id?.playlistId;
          if (!pid || seenIds.has(pid)) continue;
          seenIds.add(pid);
          rawRows.push(mapSearchItemToRaw(it, seed.tags));
        }
        break; // success
      } catch (err) {
        lastErr = err;
        const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || '';
        if (reason === 'quotaExceeded' || reason === 'userRateLimitExceeded') {
          console.warn(`[quota] search.list key ${String(key).slice(0,8)} exceeded → cooldown`);
          keyPool.setCooldown(key, 60);
          await logApiUsage({ apiKey: key, endpoint: 'search.list', quotaCost: 100, status: 'error', errorCode: reason, errorMessage: err?.message || String(err) });
          await sleep(300);
          continue;
        }
        console.warn('[youtube] ⚠️ search.list error:', err?.message || String(err));
        await logApiUsage({ apiKey: key, endpoint: 'search.list', quotaCost: 100, status: 'error', errorCode: reason || 'unknown', errorMessage: err?.message || String(err) });
        break;
      }
    }
  }

  const discovered = rawRows.length;
  if (!discovered) {
    await setJobCursor('seed_discovery', { day, slot, finished_at: isoNow(), discovered: 0, inserted: 0, promoted: 0 });
    console.log(`[seedDiscovery] 💤 No playlists discovered (day=${day} slot=${slot})`);
    return { discovered: 0, inserted: 0, promoted: 0, tracks: 0 };
  }

  const ids = Array.from(seenIds);
  // Validate visibility + counts
  const validated = await validatePlaylists(ids);
  const validIds = new Set(validated.filter(v => v.is_public && (v.item_count ?? 0) > 0).map(v => v.external_id));
  const promote = rawRows.filter(x => validIds.has(x.external_id)).map((x) => ({
    external_id: x.external_id,
    title: x.title,
    description: x.description,
    channel_id: x.channel_id,
    channel_title: x.channel_title,
    cover_url: x.thumbnail_url,
    region: x.region,
    category: x.category,
    is_public: true,
    is_empty: false,
    item_count: validated.find(v => v.external_id === x.external_id)?.item_count || null,
    fetched_on: x.fetched_on,
    last_refreshed_on: isoNow(),
  }));

  // Enrich raw rows with item_count from validation (mutable column)
  const itemCountMap = new Map(validated.map(v => [v.external_id, v.item_count]));
  const enrichedRaw = rawRows.map(r => ({ ...r, item_count: itemCountMap.get(r.external_id) ?? null }));
  const { upserted: upsertedRaw, duplicates, categoryLogWarnings } = await insertPlaylistsRaw(enrichedRaw);
  const insertedRaw = upsertedRaw;
  // Pre-log for raw upsert (keeps final metadata-only log unchanged)
  console.log(`[seeds] 🟢 upserted ${upsertedRaw} playlists (skipped ${duplicates} duplicates${categoryLogWarnings ? `, ignored ${categoryLogWarnings} category_log warning${categoryLogWarnings > 1 ? 's' : ''}` : ''})`);
  const promotedCount = await upsertPlaylists(promote);

  // Metadata-only: no track/item fetch during seed discovery
  await setJobCursor('seed_discovery', { day, slot, finished_at: isoNow(), discovered, inserted: insertedRaw, promoted: promotedCount, tracks: 0 });
  console.log(`[seedDiscovery] metadata-only: discovered=${discovered} inserted_raw=${insertedRaw} promoted=${promotedCount} (no tracks written)`);
  return { discovered, inserted: insertedRaw, promoted: promotedCount, tracks: 0 };
}
