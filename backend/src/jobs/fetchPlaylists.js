// backend/src/jobs/fetchPlaylists.js
// ✅ Discovery (search) + validation (playlists.list) + promote to playlists

import supabase from '../lib/supabase.js';
import { pickTodayRegions, sleep } from '../lib/utils.js';
import { searchPlaylists, validatePlaylists } from '../lib/youtube.js';

const REGIONS_PER_DAY = 10; // start conservative; scale up later
const CATEGORIES_PER_DAY = 22; // pick a slice of categories
const DAILY_PLAYLIST_CAP = 6000;
const INSERT_CHUNK = 500;

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const it of arr) {
    const k = keyFn(it);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

async function insertChunks(table, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      console.error(`[fetch] ❌ Insert chunk into ${table} failed:`, error.message);
    } else {
      inserted += chunk.length;
    }
    await sleep(80);
  }
  return inserted;
}

export async function runFetchPlaylists() {
  console.log('[fetch] 🚀 Starting discovery + validation');

  // Regions (deterministic slice)
  const regions = pickTodayRegions(REGIONS_PER_DAY);
  // Categories from DB (first N, can later rotate deterministically)
  const { data: cats } = await supabase
    .from('categories')
    .select('key')
    .limit(CATEGORIES_PER_DAY);
  const categories = (cats || []).map((c) => c.key);
  if (!categories.length) categories.push('music');

  // 1) Discovery via search.list
  let discovered = [];
  for (const region of regions) {
    for (const cat of categories) {
      const items = await searchPlaylists({ query: `${cat} music`, regionCode: region, maxPages: 1 });
      const mapped = (items || []).map((it) => ({
        external_id: it.id?.playlistId,
        title: it.snippet?.title,
        description: it.snippet?.description,
        channel_id: it.snippet?.channelId,
        channel_title: it.snippet?.channelTitle,
        region: region,
        category: cat,
        thumbnail_url: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || null,
        fetched_on: new Date().toISOString(),
        validated: false,
        cycle_mode: 'FETCH',
      })).filter((x) => !!x.external_id);
      discovered.push(...mapped);
      await sleep(120);
      if (discovered.length > DAILY_PLAYLIST_CAP * 1.5) break;
    }
    if (discovered.length > DAILY_PLAYLIST_CAP * 1.5) break;
  }

  if (!discovered.length) {
    console.log('[fetch] ⚠️ Nothing discovered');
    return;
  }

  // Dedup on external_id
  const deduped = uniqueBy(discovered, (x) => x.external_id);
  console.log(`[fetch] discovered=${discovered.length} deduped=${deduped.length}`);

  // 2) Validation via playlists.list
  const ids = deduped.map((x) => x.external_id).slice(0, 10000);
  const validated = await validatePlaylists(ids);
  const validIds = new Set(validated.filter((v) => v.is_public && v.item_count > 0).map((v) => v.external_id));

  // 3) Store raw and promote valid
  await insertChunks('playlists_raw', deduped.map((x) => ({ ...x, privacy_status: null }))); // lightweight store

  const promote = deduped
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
      validated_on: new Date().toISOString(),
      last_etag: validated.find((v) => v.external_id === x.external_id)?.etag || null,
      cycle_day: null,
      cycle_mode: 'FETCH',
    }));

  if (!promote.length) {
    console.log('[fetch] ℹ️ No valid playlists to promote');
    return;
  }

  // Upsert valid playlists
  const { error: upErr } = await supabase
    .from('playlists')
    .upsert(promote, { onConflict: 'external_id' });
  if (upErr) {
    console.error('[fetch] ❌ Promote upsert failed:', upErr.message);
  } else {
    console.log(`[fetch] ✅ Promoted ${promote.length} playlists`);
  }
}
