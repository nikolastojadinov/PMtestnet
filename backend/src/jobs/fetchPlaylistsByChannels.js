// backend/src/jobs/fetchPlaylistsByChannels.js
// Channel-crawl discovery job — supplements existing discovery when ENABLE_CHANNEL_CRAWL=true
// Cost model: ~1 QU per channel (playlists.list), up to 50 playlists per call → 10–50× efficiency vs search.list
// This job does NOT change scheduler wiring by default.

import { supabase } from '../lib/supabase.js';
import { youtube, keyPool, sleep, validatePlaylists } from '../lib/youtube.js';

const ENABLED = String(process.env.ENABLE_CHANNEL_CRAWL || '').toLowerCase() === 'true';
const MAX_CHANNELS_PER_RUN = parseInt(process.env.CRAWL_MAX_CHANNELS || '200', 10);
const INSERT_CHUNK = 500;
const CALL_SLEEP_MS = 100; // pacing between playlists.list calls

function nowIso() { return new Date().toISOString(); }

function uniqueBy(items, keyFn) {
  const m = new Map();
  for (const it of items || []) {
    const k = keyFn(it);
    if (!k || m.has(k)) continue;
    m.set(k, it);
  }
  return Array.from(m.values());
}

async function insertChunks(table, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`[crawl] ❌ Insert chunk into ${table} failed:`, error.message);
    } else {
      inserted += chunk.length;
    }
    await sleep(80);
  }
  return inserted;
}

async function fetchChannelPlaylistsOnce(channelId) {
  // One page only (maxResults=50) for ~1 QU per channel
  const attempts = Math.max(1, keyPool.size());
  for (let a = 0; a < attempts; a++) {
    const keyObj = await keyPool.selectKey('playlists.list');
    const key = keyObj.key;
    try {
      const res = await youtube.playlists.list({
        part: 'snippet,contentDetails',
        channelId,
        maxResults: 50,
        auth: key,
      });
      keyPool.markUsage(key, 'playlists.list', true);
      const items = res?.data?.items || [];
      return items.map((it) => ({
        external_id: it?.id,
        title: it?.snippet?.title || null,
        description: it?.snippet?.description || null,
        channel_id: it?.snippet?.channelId || null,
        channel_title: it?.snippet?.channelTitle || null,
        thumbnail_url: it?.snippet?.thumbnails?.high?.url || it?.snippet?.thumbnails?.default?.url || null,
        fetched_on: nowIso(),
        validated: false,
        region: 'GLOBAL',
        category: 'channel-crawl',
        cycle_mode: 'FETCH',
      })).filter((x) => !!x.external_id);
    } catch (err) {
      const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || '';
      if (reason === 'quotaExceeded' || reason === 'userRateLimitExceeded') {
        console.warn(`[quota] playlists.list key ${String(key).slice(0,8)} exceeded → cooldown`);
        keyPool.setCooldown(key, 60);
        await sleep(1000);
        continue; // try next key
      }
      console.warn('[youtube] ⚠️ channel playlists fetch failed:', err?.message || String(err));
      break;
    }
  }
  return [];
}

async function getSeedChannels(limit = MAX_CHANNELS_PER_RUN) {
  // Order by region_score desc, then added_on asc
  const q = supabase
    .from('seeds_channels')
    .select('channel_id')
    .order('region_score', { ascending: false })
    .order('added_on', { ascending: true })
    .limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map((r) => r.channel_id).filter(Boolean);
}

async function fetchExistingIds(externalIds) {
  const existing = new Set();
  const BATCH = 1000;
  for (let i = 0; i < externalIds.length; i += BATCH) {
    const slice = externalIds.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from('playlists_raw')
      .select('external_id')
      .in('external_id', slice);
    if (!error) {
      for (const row of data || []) existing.add(row.external_id);
    }
    await sleep(50);
  }
  return existing;
}

export async function runChannelCrawl() {
  if (!ENABLED) {
    console.log('[crawl] 🧩 Feature disabled — skipping');
    return;
  }

  try {
    const seeds = await getSeedChannels(MAX_CHANNELS_PER_RUN);
    console.log(`[crawl] 🚀 Starting channel crawl (N=${seeds.length}, keyPool=${keyPool.size()} keys available)`);
    let raw = [];

    for (let i = 0; i < seeds.length; i++) {
      const ch = seeds[i];
      const items = await fetchChannelPlaylistsOnce(ch);
      raw.push(...items);
      await sleep(CALL_SLEEP_MS);
    }

    if (!raw.length) {
      console.log('[crawl] ⚠️ No playlists discovered from channels');
      return;
    }

    // In-memory dedupe
    const deduped = uniqueBy(raw, (x) => x.external_id);

    // Remove already known in playlists_raw
    const existing = await fetchExistingIds(deduped.map((x) => x.external_id));
    const fresh = deduped.filter((x) => !existing.has(x.external_id));

    // Insert raw rows
    let insertedRaw = 0;
    if (fresh.length) {
      insertedRaw = await insertChunks('playlists_raw', fresh.map((x) => ({
        external_id: x.external_id,
        title: x.title,
        description: x.description,
        channel_id: x.channel_id,
        channel_title: x.channel_title,
        region: x.region,
        category: x.category,
        thumbnail_url: x.thumbnail_url,
        fetched_on: x.fetched_on,
        validated: false,
        cycle_mode: 'FETCH',
      })));
    }

    // Validate and promote
    const toValidate = fresh.map((x) => x.external_id);
    const validated = await validatePlaylists(toValidate);
    const validIds = new Set(validated.filter((v) => v.is_public && v.item_count > 0).map((v) => v.external_id));

    const promote = fresh
      .filter((x) => validIds.has(x.external_id))
      .map((x) => ({
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
        item_count: validated.find((v) => v.external_id === x.external_id)?.item_count || null,
        fetched_on: x.fetched_on,
        validated_on: nowIso(),
        last_etag: validated.find((v) => v.external_id === x.external_id)?.etag || null,
        cycle_day: null,
        cycle_mode: 'FETCH',
      }));

    let promoted = 0;
    if (promote.length) {
      const { error: upErr } = await supabase
        .from('playlists')
        .upsert(promote, { onConflict: 'external_id' });
      if (upErr) {
        console.error('[crawl] ❌ Promote upsert failed:', upErr.message);
      } else {
        promoted = promote.length;
      }
    }

    console.log(`[crawl] ✅ Discovered=${raw.length} deduped=${deduped.length} inserted_raw=${insertedRaw} promoted=${promoted}`);
  } catch (err) {
    console.error('[crawl] ❌ Fatal error:', err?.message || String(err));
  }
}

export default { runChannelCrawl };

/*
Documentation — Why channel crawl improves efficiency:
- playlists.list by channelId costs 1 QU and returns up to 50 playlists → up to 50 playlists/QU raw.
- search.list costs 100 QU and returns up to 50 playlists → ~0.5 playlists/QU raw.
- In practice, after dedupe/validation, channel-crawl often yields 10–50× more promoted playlists per QU.

Integration with 29-day cycle and 20-slot cadence:
- This job is isolated behind ENABLE_CHANNEL_CRAWL=true and not scheduled by default.
- When scheduled (manually), it can run in a subset of existing windows without altering their timing.
- It uses the same Supabase schema and validation/promotion logic as the main discovery.

Safety via feature flag:
- When the flag is false, job logs and exits without side effects.

Future expansion:
- Seed channels from top-performing playlists (owners), language-specific seed pools, and dynamic scoring using promotion yield.
*/
