// backend/src/jobs/fetchPlaylists.js
// ✅ Discovery (search) + validation (playlists.list) + promote to playlists

import { supabase } from '../lib/supabase.js';
import { pickTodayRegions, sleep, selectCategoriesForDay, getCycleDay } from '../lib/utils.js';
import { searchPlaylists, validatePlaylists } from '../lib/youtube.js';
import { startFetchRun, finishFetchRun } from '../lib/metrics.js';

const REGIONS_PER_DAY = 10; // start conservative; scale up later
const CATEGORIES_PER_DAY = 22; // total categories; we'll choose a rotating slice of 12/day
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
  const runId = await startFetchRun({ day: null });

  // Regions (deterministic slice)
  const regions = pickTodayRegions(REGIONS_PER_DAY);
  // Categories from DB (first N, can later rotate deterministically)
  const { data: cats } = await supabase
    .from('categories')
    .select('key')
    .limit(CATEGORIES_PER_DAY);
  const allCategories = (cats || []).map((c) => c.key);
  if (!allCategories.length) allCategories.push('music');
  const day = getCycleDay();
  const categories = selectCategoriesForDay(allCategories, day);
  console.log(`[fetch] categories/day=${categories.length} (day=${day})`);

  // 1) Discovery via search.list
  let discovered = [];
  for (const region of regions) {
    if (region === 'GLOBAL') {
      console.log('[fetch] skipped region filter for GLOBAL (search without regionCode)');
    }
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
      await sleep(80);
      if (discovered.length > DAILY_PLAYLIST_CAP * 1.2) {
        console.log('[fetch] ⚠️ Early exit due to soft cap exceed');
        break;
      }
    }
    if (discovered.length > DAILY_PLAYLIST_CAP * 1.2) break;
  }

  if (!discovered.length) {
    console.log('[fetch] ⚠️ Nothing discovered');
    await finishFetchRun(runId, { items_discovered: 0, playlists_valid: 0, playlists_invalid: 0 });
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
    await finishFetchRun(runId, { items_discovered: deduped.length, playlists_valid: 0, playlists_invalid: deduped.length });
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

  await finishFetchRun(runId, {
    items_discovered: deduped.length,
    playlists_valid: promote.length,
    playlists_invalid: Math.max(0, deduped.length - promote.length),
  });
}
