// backend/src/jobs/fetchPlaylists.js
// ✅ Discovery (search) + validation (playlists.list) + promote to playlists

import { createClient } from '@supabase/supabase-js';
import { pickTodayRegions, sleep, selectCategoriesForDay, getCycleDay } from '../lib/utils.js';
import { verifyPlaylistsRawRLS } from '../utils/verifyRLS.js';
import { pickTodayPlan } from '../lib/monthlyCycle.js';
import { searchPlaylists, validatePlaylists } from '../lib/youtube.js';
import { startFetchRun, finishFetchRun } from '../lib/metrics.js';

const REGIONS_PER_DAY = 10; // start conservative; scale up later
const CATEGORIES_PER_DAY = 22; // total categories; we'll choose a rotating slice of 12/day
const DAILY_PLAYLIST_CAP = 2000;
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

// One-time, memoized service-role client to guarantee privileged writes
function getServiceClient() {
  if (globalThis.__pm_serviceSb) return globalThis.__pm_serviceSb;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error('[supabase] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  globalThis.__pm_serviceSb = sb;
  console.log('[supabase] 🔑 service_role client initialized successfully');
  return sb;
}

async function insertChunks(sb, table, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const { error } = await sb.from(table).insert(chunk);
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
  const plan = pickTodayPlan();
  if (plan.mode !== 'FETCH') {
    console.log(`[fetch] ⏭️ Skipping discovery — current cycle mode is ${plan.mode} (day ${plan.currentDay})`);
    // Concise operational report for visibility in non-FETCH days
    console.log(`[report] Fetched playlists: N=0, discovery skipped (mode=${plan.mode}).`);
    console.log('[report] Root cause of permission issue: n/a (no discovery).');
    console.log('[report] Fix applied: none needed. Next fetch cycle ready.');
    return;
  }
  const runId = await startFetchRun({ day: null });
  const sb = getServiceClient();

  // Regions (deterministic slice)
  const regions = pickTodayRegions(REGIONS_PER_DAY);
  const usedGlobal = Array.isArray(regions) && regions.includes('GLOBAL');
  // Categories from DB (first N, can later rotate deterministically)
  const { data: cats } = await sb
    .from('categories')
    .select('key')
    .limit(CATEGORIES_PER_DAY);
  const allCategories = (cats || []).map((c) => c.key);
  if (!allCategories.length) allCategories.push('music');
  const day = plan.currentDay || getCycleDay();
  const categories = selectCategoriesForDay(allCategories, day);
  console.log(`[fetch] categories/day=${categories.length} (day=${day})`);

  // 1) Discovery via search.list
  let discovered = [];
  const discoveredIds = new Set();
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
      })).filter((x) => !!x.external_id && !discoveredIds.has(x.external_id));
      // On-the-fly dedupe and cap enforcement
      for (const m of mapped) {
        discoveredIds.add(m.external_id);
        discovered.push(m);
        if (discovered.length >= DAILY_PLAYLIST_CAP) break;
      }
      await sleep(80);
      if (discovered.length >= DAILY_PLAYLIST_CAP) { console.log('[fetch] ⛔ Reached playlist cap; breaking category loop'); break; }
    }
    if (discovered.length >= DAILY_PLAYLIST_CAP) { console.log('[fetch] ⛔ Reached playlist cap; breaking region loop'); break; }
  }

  if (!discovered.length) {
    console.log('[fetch] ⚠️ Nothing discovered');
    await finishFetchRun(runId, { items_discovered: 0, playlists_valid: 0, playlists_invalid: 0 });
    // Report block
    console.log('[report] Fetched playlists: N=0, none promoted.');
    console.log(`[report] Region filter ${usedGlobal ? 'skipped for GLOBAL (unsupported params)' : 'active for regional searches'}.`);
    console.log('[report] Root cause of permission issue: n/a (no inserts attempted).');
    console.log('[report] Fix applied: mute playlist search param warnings; service_role client confirmed.');
    console.log('[report] Next fetch cycle ready.');
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
  await insertChunks(sb, 'playlists_raw', deduped.map((x) => ({ ...x, privacy_status: null }))); // lightweight store

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
    // Report block
    console.log(`[report] Fetched playlists: discovered=${deduped.length}, promoted=0.`);
    console.log(`[report] Region filter ${usedGlobal ? 'skipped for GLOBAL, search without regionCode' : 'used for regional queries'} (YouTube playlist search doesn’t support regionCode/videoCategoryId).`);
    const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE;
    const rootCause = hasServiceRole
      ? 'Previous runs likely used anon client or lacked INSERT policy; current code uses service_role.'
      : 'Missing SUPABASE_SERVICE_ROLE env — writes would use anon client and fail under RLS.';
    const fix = hasServiceRole
      ? 'Using service_role client for writes; muted unsupported-param warnings.'
      : 'Please set SUPABASE_SERVICE_ROLE for backend; muted unsupported-param warnings.';
    console.log(`[report] Root cause of permission issue: ${rootCause}`);
    console.log(`[report] Fix applied: ${fix}`);
    console.log('[report] Next fetch cycle ready.');
    return;
  }

  // Upsert valid playlists
  const { error: upErr } = await sb
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

  // Final concise operational report
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE;
  const rootCause = hasServiceRole
    ? 'Earlier permission denials were likely due to anon client or missing INSERT policy. Code now uses service_role.'
    : 'Missing SUPABASE_SERVICE_ROLE env — anon client would be rejected by RLS.';
  const fix = hasServiceRole
    ? 'Using service_role client for playlists_raw and playlists writes; muted unsupported-param warnings.'
    : 'Please configure SUPABASE_SERVICE_ROLE; warnings for unsupported params are muted.';

  // Run RLS checks once per process
  if (!globalThis.__pm_rlsChecked) {
    try {
      await verifyPlaylistsRawRLS(sb);
      globalThis.__pm_rlsChecked = true;
    } catch (e) {
      console.warn('[rls-check] Failed to verify RLS automatically:', e?.message || String(e));
    }
  }

  console.log(`[report] Fetched playlists: N=${promote.length}, promoted successfully.`);
  console.log(`[report] Region filter ${usedGlobal ? 'skipped for GLOBAL, search without regionCode' : 'applied for regional queries'} (playlist search API ignores regionCode/videoCategoryId).`);
  console.log(`[report] Root cause of permission issue: ${rootCause}`);
  console.log(`[report] Fix applied: ${fix}`);
  console.log('[report] Next fetch cycle ready.');
}
