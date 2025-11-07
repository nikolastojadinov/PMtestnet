// backend/src/lib/scheduler.js (FULL REWRITE per incident report)
// Goals:
//  - Preserve playlist discovery + purge jobs
//  - Replace warm-up / track-fetch pipeline with stateless 30-min cadence
//  - Each 30‑minute slot:
//      * Logs tick
//      * Prepares fresh warm-up targets via RPC prepare_warmup_targets(p_limit) (fallback to local select)
//      * Fetches tracks for prepared playlists (3k–3.5k) with natural throttling
//      * Releases slot lock (delete job_state key track_slot_<slotId>)
//  - No shared global state between slots (prevent freeze after first slot)
//  - Cursor logic for playlist discovery retained (separate concern)

import cron from 'node-cron';
import supabase from './supabase.js';
import { pickDaySlotList } from './searchSeedsGenerator.js';
import { runSeedDiscovery, runPurgeTracks } from './jobs.js';
import { loadJobCursor as loadCursor, saveJobCursor as saveCursor, upsertTracksSafe, upsertPlaylistTracksSafe, setJobState } from './persistence.js';
import { fetchPlaylistItems, sleep } from './youtube.js';

const TZ = process.env.TZ || 'Europe/Budapest';
process.env.TZ = TZ; // enforce timezone

// 1) Fixed cron definitions
const playlistSlots = [
  '5 9 * * *',  '35 9 * * *',
  '5 10 * * *', '35 10 * * *',
  '5 11 * * *', '35 11 * * *',
  '5 12 * * *', '35 12 * * *',
  '5 13 * * *', '35 13 * * *',
  '5 14 * * *', '35 14 * * *',
  '5 15 * * *', '35 15 * * *',
  '5 16 * * *', '35 16 * * *',
  '5 17 * * *', '35 17 * * *',
  '5 18 * * *', '35 18 * * *',
];

// Track/ Warm-up unified 30‑minute cadence (19:30→04:30 local time) handled by a single scheduler list
// We schedule two patterns to cover evening (19-23) and early morning (0-4)
const trackUnifiedSlots = [
  '30 19 * * *','0 20 * * *','30 20 * * *','0 21 * * *','30 21 * * *','0 22 * * *','30 22 * * *','0 23 * * *','30 23 * * *',
  '0 0 * * *','30 0 * * *','0 1 * * *','30 1 * * *','0 2 * * *','30 2 * * *','0 3 * * *','30 3 * * *','0 4 * * *','30 4 * * *'
];

// 2) Persistence helpers
let cursor = { day: 1, slot: 0 };
let cursorReady = false;
let running = false;

function isoNow() { return new Date().toISOString(); }

// Playlist cursor retained ONLY for daytime playlist discovery; do not resume old slot after restart
export async function loadJobCursor() {
  try {
    // Always recompute cycle day fresh; start slot at 0 daily
    const day = getCycleDay(new Date());
    cursor = { day, slot: 0 };
    await saveCursor({ day, slot: 0, last_run: isoNow() }, 'playlist_scheduler');
    console.log(`[cursor] fresh init day=${day} slot=0 (no resume)`);
    cursorReady = true;
  } catch (e) {
    console.warn('[cursor] ⚠️ cursor init failed — using defaults:', e?.message || String(e));
    cursorReady = true;
  }
}

export async function updateJobCursor(day, slot) {
  await saveCursor({ day, slot, last_run: isoNow() }, 'playlist_scheduler');
  cursor = { day, slot };
}

// 3) Category auto-assignment
const KEYWORD_MAP = {
  'kpop': 'K-pop',
  'bollywood': 'Bollywood',
  'lofi': 'Lo-fi',
  'jazz': 'Jazz',
  'workout': 'Workout',
  'chill': 'Chill',
  'retro': '80s',
  'classic': 'Classics',
  'vietnamese': 'Vietnamese',
  'hindi': 'Hindi',
  'pop': 'Pop',
  'rock': 'Rock',
};

export function categorizePlaylist(title, description, channelTitle) {
  const t = `${title || ''} ${description || ''} ${channelTitle || ''}`.toLowerCase();
  for (const [kw, cat] of Object.entries(KEYWORD_MAP)) {
    if (t.includes(kw)) return cat;
  }
  return 'Other';
}

async function categorizeUnlabeledPlaylists(limit = 200) {
  try {
    const { data, error } = await supabase
      .from('playlists')
      .select('id,title,description,channel_title,category')
      .is('category', null)
      .order('fetched_on', { ascending: false })
      .limit(limit);
    if (error) { console.warn('[scheduler] ⚠️ fetch unlabeled playlists failed:', error.message); return 0; }
    let updated = 0;
    for (const row of data || []) {
      const cat = categorizePlaylist(row.title, row.description, row.channel_title);
      const { error: e2 } = await supabase
        .from('playlists')
        .update({ category: cat })
        .eq('id', row.id);
      if (!e2) updated++;
    }
    if (updated > 0) console.log(`[scheduler] 🏷️ categorized ${updated} playlists`);
    return updated;
  } catch (e) {
    console.warn('[scheduler] ⚠️ categorize failed:', e?.message || String(e));
    return 0;
  }
}

// 4) STATeless track slot preparation & fetching

function isoSlotId(date = new Date()) {
  // Use HHmm in Europe/Budapest (process.env.TZ already set) for deterministic slot id
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}${m}`; // e.g. 1930
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function rpcPrepareWarmup(limit) {
  try {
    const { data, error } = await supabase.rpc('prepare_warmup_targets', { p_limit: limit });
    if (error) throw error;
    if (!data) return [];
    return data; // expecting rows: [{id, external_id}] or similar
  } catch (e) {
    console.warn('[warmup] ⚠️ RPC prepare_warmup_targets failed:', e.message || String(e));
    return null; // signal fallback
  }
}

async function fallbackSelectWarmup(limit) {
  // Simple random sampling fallback (may be less efficient but ensures progress)
  const oversample = Math.min(limit * 2, 10000);
  const { data, error } = await supabase
    .from('playlists')
    .select('id,external_id')
    .eq('is_public', true)
    .gt('item_count', 0)
    .order('last_refreshed_on', { ascending: true, nullsFirst: true })
    .limit(oversample);
  if (error) { console.warn('[warmup] ⚠️ fallback select failed:', error.message); return []; }
  const arr = data || [];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, limit);
}

async function releaseSlotLock(slotId) {
  try {
    await supabase.from('job_state').delete().eq('key', `track_slot_${slotId}`);
    console.log(`[scheduler] 🔁 slot ${slotId} released`);
  } catch (e) {
    console.warn('[scheduler] ⚠️ release slot lock failed:', e.message || String(e));
  }
}

function mapTrackAndLink(plId, item, pos) {
  const videoId = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId || null;
  if (!videoId) return null;
  return {
    track: {
      external_id: videoId,
      title: item?.snippet?.title || null,
      artist: item?.snippet?.videoOwnerChannelTitle || item?.snippet?.channelTitle || null,
      cover_url: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.default?.url || null,
    },
    link: { playlist_id: plId, external_id: videoId, position: pos },
  };
}

async function processStatelessTrackSlot(now = new Date()) {
  console.log(`[scheduler] ⏱ tick executed at ${now.toISOString()}`);
  const slotId = isoSlotId(now);
  // Acquire lock (best effort) — insert row; ignore if fails
  try { await supabase.from('job_state').upsert({ key: `track_slot_${slotId}`, value: { started_at: now.toISOString() } }, { onConflict: 'key' }); } catch {}

  // 1. Warm-up target selection (RPC then fallback)
  const targetLimit = 3500; // request upper bound; RPC will internally apply least(p_limit,3500)
  let targets = await rpcPrepareWarmup(targetLimit);
  if (!targets) targets = await fallbackSelectWarmup(targetLimit);
  if (!targets || !targets.length) {
    console.log('[warmup] ⚠️ no playlists available');
    await releaseSlotLock(slotId);
    return;
  }
  console.log(`[warmup] 🎯 prepared ${targets.length} playlists for slot ${slotId} (tracks=0)`);
  // Persist target summary for observability/debug (non-lock)
  try { await setJobState(`warmup_summary_${slotId}`, { count: targets.length, generated_at: isoNow() }); } catch {}

  // 2. Track fetch & persistence (stateless workers)
  const total = targets.length;
  const workers = Math.min(12, Math.max(6, Math.round(total / 320))); // adaptive
  const chunkSize = Math.ceil(total / workers);
  let processed = 0;
  let apiCalls = 0;
  const start = Date.now();
  const deadline = start + 20 * 60 * 1000;
  let earlyStop = false;

  const workerFns = [];
  for (let w = 0; w < workers; w++) {
    const slice = targets.slice(w * chunkSize, Math.min((w + 1) * chunkSize, total));
    workerFns.push((async () => {
      const trackBuf = [];
      const linkBuf = [];
      let localCalls = 0;
      for (let i = 0; i < slice.length; i++) {
        if (Date.now() > deadline) { earlyStop = true; break; }
        const pl = slice[i];
        await sleep(180 + Math.floor(Math.random() * 41)); // pacing
        try {
          const items = await fetchPlaylistItems(pl.external_id, 1);
          localCalls++; apiCalls++;
          const LIM = 200;
            for (let k = 0; k < Math.min(items.length, LIM); k++) {
              const mapped = mapTrackAndLink(pl.id, items[k], k + 1);
              if (mapped) {
                trackBuf.push(mapped.track);
                linkBuf.push(mapped.link);
              }
            }
        } catch {}
        processed++;
        if (processed % 1000 === 0) {
          console.log(`[tracks] ⏱ progress: ${processed}/${total} playlists fetched`);
        }
        if (localCalls > 0 && localCalls % 300 === 0) {
          await sleep(2000 + Math.floor(Math.random() * 1001));
        }
        if (trackBuf.length >= 1000 || i === slice.length - 1 || earlyStop) {
          if (trackBuf.length) {
            await upsertTracksSafe(trackBuf, 500);
            // resolve external ids for links
            const ids = Array.from(new Set(linkBuf.map(l => l.external_id)));
            const idMap = new Map();
            for (let p = 0; p < ids.length; p += 500) {
              const chunk = ids.slice(p, p + 500);
              const { data, error } = await supabase.from('tracks').select('id,external_id').in('external_id', chunk);
              if (!error && data) for (const r of data) idMap.set(r.external_id, r.id);
              await sleep(40);
            }
            const linkRows = linkBuf.map(l => ({ playlist_id: l.playlist_id, track_id: idMap.get(l.external_id), position: l.position })).filter(r => r.track_id);
            if (linkRows.length) await upsertPlaylistTracksSafe(linkRows, 500);
          }
          trackBuf.length = 0; linkBuf.length = 0;
        }
      }
    })());
  }
  await Promise.allSettled(workerFns);
  const durMs = Date.now() - start;
  const mm = Math.floor(durMs / 60000); const ss = Math.floor((durMs % 60000) / 1000);
  console.log(`[tracks] ${earlyStop ? '⏹' : '✅'} slot ${slotId} done in ${mm}m ${ss}s (unitCost=${apiCalls})`);

  // 3. Release lock & clear any ephemeral references
  await releaseSlotLock(slotId);
}

// 5) Start scheduler
export function startFixedJobs() {
  const tasks = [];
  // Load cursor on startup without changing index.js signature
  (async () => { await loadJobCursor(); })();

  // Playlists — persistent day/slot progression (cron-only, no auto-run on startup)
  playlistSlots.forEach((pattern) => {
    tasks.push(cron.schedule(pattern, async () => {
      if (!cursorReady) await loadJobCursor();
      if (running) { console.log('[scheduler] ⏳ previous slot still running — skipping'); return; }
      running = true;
      const day = cursor.day;
      const slot = cursor.slot;
      const queries = pickDaySlotList(day, slot);
      console.log(`[scheduler] ⏰ Playlist slot ${pattern} (${TZ}) → day=${day} slot=${slot} queries=${queries.length}`);
      try {
        const summary = await runSeedDiscovery(day, slot);
        console.log(`[seedDiscovery] ✅ slot=${slot} discovered=${summary.discovered} inserted=${summary.inserted} promoted=${summary.promoted} tracks=${summary.tracks}`);
        // Advance cursor deterministically
        const nextSlot = (slot + 1) % 20;
        const nextDay = nextSlot === 0 ? ((day % 29) + 1) : day;
        await updateJobCursor(nextDay, nextSlot);
      } catch (e) {
        console.warn('[seedDiscovery] ❌ slot failure:', e?.message || String(e));
      } finally {
        running = false;
      }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Playlist fetch job active at ${pattern} (${TZ})`);
  });

  // Unified 30‑minute track slots (stateless per tick)
  trackUnifiedSlots.forEach(pattern => {
    tasks.push(cron.schedule(pattern, async () => {
      try { await processStatelessTrackSlot(new Date()); } catch (e) { console.warn('[tracks] ⚠️ stateless slot error:', e.message || String(e)); }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Track slot active at ${pattern} (${TZ})`);
  });

  // Purge-tracks daily at 19:00 (cron-only)
  const purgePattern = '0 19 * * *';
  tasks.push(cron.schedule(purgePattern, async () => {
    console.log(`[scheduler] 🧹 purge-tracks job triggered (${purgePattern} Europe/Budapest)`);
    try { await runPurgeTracks(); } catch (e) { console.warn('[purge-tracks] ⚠️ error:', e?.message || String(e)); }
  }, { timezone: TZ }));
  console.log(`[scheduler] ⏰ Purge-tracks job active at ${purgePattern} (${TZ})`);

  console.log(`[scheduler] ✅ cron set (${TZ}):\n  - playlists@09:05→18:35 (every 30 min)\n  - tracks(stateless)@19:30→04:30 (every 30 min)`);
  console.log('[scheduler] 🔒 No auto-start after deploy — waiting for cron signals only.');
  startFixedJobs._tasks = tasks;
}

export function stopAllJobs() {
  if (Array.isArray(startFixedJobs._tasks)) {
    for (const t of startFixedJobs._tasks) {
      try { t.stop(); } catch {}
    }
  }
}

// 6) Backward-compatible cycle day helper (needed by index.js for initial seed trigger)
export function getCycleDay(now = new Date()) {
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const [y, m, d] = startEnv.split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const diffDays = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / (24 * 3600 * 1000));
  return ((diffDays % 29) + 29) % 29 + 1; // 1..29
}
