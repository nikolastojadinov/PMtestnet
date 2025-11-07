// backend/src/lib/scheduler.js
// Fully persistent scheduler with auto-category assignment
// - Playlists: 20 slots (09:05→18:35, every 30 min)
// - Warm-up:   10 slots (19:15→04:15, hourly)
// - Tracks:    10 slots (19:30→04:30, hourly)
// - Timezone:  Europe/Budapest
// - Persistence: day/slot resume via job_cursor

import cron from 'node-cron';
import supabase from './supabase.js';
import { pickDaySlotList } from './searchSeedsGenerator.js';
import { runSeedDiscovery, runPurgeTracks } from './jobs.js';
import { loadJobCursor as loadCursor, saveJobCursor as saveCursor, setJobState, getJobState, upsertTracksSafe, upsertPlaylistTracksSafe } from './persistence.js';
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

// Nightly warm-up and track-fetch (balanced 30-min cadence)
// warm-up: 19:25, 19:55, ... 03:55, 04:25 (not 04:55)
const warmupSlots = [
  // :25 for 19..04
  '25 19 * * *', '25 20 * * *', '25 21 * * *', '25 22 * * *', '25 23 * * *',
  '25 0 * * *',  '25 1 * * *',  '25 2 * * *',  '25 3 * * *',  '25 4 * * *',
  // :55 for 19..03 only (04:55 excluded)
  '55 19 * * *', '55 20 * * *', '55 21 * * *', '55 22 * * *', '55 23 * * *',
  '55 0 * * *',  '55 1 * * *',  '55 2 * * *',  '55 3 * * *',
];

// track-fetch: starts 5 min after warm-up → 19:30, 20:00, ... 04:30
const trackFetchSlots = [
  // :30 for 19..04
  '30 19 * * *', '30 20 * * *', '30 21 * * *', '30 22 * * *', '30 23 * * *',
  '30 0 * * *',  '30 1 * * *',  '30 2 * * *',  '30 3 * * *',  '30 4 * * *',
  // :00 for 20..04 (19:00 excluded)
  '0 20 * * *',  '0 21 * * *',  '0 22 * * *',  '0 23 * * *', '0 0 * * *',
  '0 1 * * *',   '0 2 * * *',   '0 3 * * *',   '0 4 * * *',
];

// 2) Persistence helpers
let cursor = { day: 1, slot: 0 };
let cursorReady = false;
let running = false;

function isoNow() { return new Date().toISOString(); }

export async function loadJobCursor() {
  try {
    const c = await loadCursor('playlist_scheduler');
    if (c && typeof c.day === 'number' && typeof c.slot === 'number') {
      cursor = { day: c.day, slot: c.slot };
      console.log(`[cursor] resumed day=${cursor.day} slot=${cursor.slot} after restart`);
    } else {
      await saveCursor({ day: 1, slot: 0, last_run: isoNow() }, 'playlist_scheduler');
      console.log('[cursor] initialized day=1 slot=0');
    }
    cursorReady = true;
  } catch (e) {
    console.warn('[cursor] ⚠️ failed to load job_cursor — defaulting to day=1 slot=0:', e?.message || String(e));
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

// 4) Warm-up preparation and track-fetch orchestration (balanced nightly cadence)

function slotLabelFromDate(d) {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function nextTrackSlotLabel(now = new Date()) {
  const m = now.getMinutes();
  const base = new Date(now);
  base.setSeconds(0, 0);
  if (m < 30) { base.setMinutes(30); } else { base.setMinutes(60); }
  return slotLabelFromDate(base);
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function selectPlaylistsWithoutTracks(target) {
  // Strategy: fetch a large recent sample, then filter out those with any playlist_tracks
  const LIMIT_POOL = Math.max(5000, Math.min(12000, target * 3));
  const { data: pool, error } = await supabase
    .from('playlists')
    .select('id,external_id')
    .eq('is_public', true)
    .gte('item_count', 1)
    .order('last_refreshed_on', { ascending: true, nullsFirst: true })
    .limit(LIMIT_POOL);
  if (error) { console.warn('[warmup] ⚠️ pool select failed:', error.message); return []; }
  if (!pool?.length) return [];
  // Shuffle pool (Fisher-Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const ids = pool.map(p => p.id);
  const existing = new Set();
  const BATCH = 500;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { data, error: e2 } = await supabase
      .from('playlist_tracks')
      .select('playlist_id')
      .in('playlist_id', chunk)
      .limit(1);
    if (!e2 && data) {
      for (const r of data) existing.add(r.playlist_id);
    }
    await sleep(60);
  }
  const candidates = [];
  for (const p of pool) {
    if (!existing.has(p.id)) candidates.push(p);
    if (candidates.length >= target) break;
  }
  return candidates;
}

async function prepareWarmupSlot(now = new Date()) {
  const slot = nextTrackSlotLabel(now);
  const target = randInt(3000, 3500);
  const candidates = await selectPlaylistsWithoutTracks(target);
  const payload = {
    slot,
    created_at: isoNow(),
    target,
    count: candidates.length,
    playlists: candidates, // [{id, external_id}]
  };
  await setJobState(`track_targets_${slot}`, payload);
  console.log(`[warmup] 🎯 prepared ${payload.count} playlists for slot ${slot} (tracks=0)`);
}

function mapItemToTrackAndLink(plId, item, pos) {
  const videoId = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId || null;
  if (!videoId) return null;
  const track = {
    external_id: videoId,
    title: item?.snippet?.title || null,
    artist: item?.snippet?.videoOwnerChannelTitle || item?.snippet?.channelTitle || null,
    cover_url: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.default?.url || null,
  };
  const link = { playlist_id: plId, track_id: null, position: pos };
  return { track, link };
}

async function processTrackFetchSlot(now = new Date()) {
  const slot = slotLabelFromDate(now);
  const key = `track_targets_${slot}`;
  const prepared = await getJobState(key);
  let list = prepared?.playlists || [];
  let target = prepared?.target || 0;
  if (!list?.length) {
    // Fallback: prepare immediately with 3000 baseline
    target = 3000;
    list = await selectPlaylistsWithoutTracks(target);
  }
  // Ensure nightly slot target expands to 3000–3500 playlists if an older cap (e.g., 1000) is encountered
  if (!target || target < 3000) {
    target = Math.min(randInt(3000, 3500), list.length);
  }
  const total = Math.min(target || list.length, list.length);
  console.log(`[tracks] 🎬 slot ${slot} started (target=${total})`);

  const start = Date.now();
  const deadline = start + 20 * 60 * 1000; // 20m cap
  const workers = Math.min(12, Math.max(10, Math.round(total / 300)));
  const chunkSize = Math.ceil(total / workers);
  let processed = 0;
  let apiCalls = 0;
  let stopped = false;

  const tasks = [];
  for (let w = 0; w < workers; w++) {
    const slice = list.slice(w * chunkSize, Math.min((w + 1) * chunkSize, total));
    tasks.push((async () => {
      const tracksBuf = [];
      const linksBuf = [];
      let localCalls = 0;
      for (let i = 0; i < slice.length; i++) {
        if (Date.now() > deadline) { stopped = true; break; }
        const pl = slice[i];
        // natural pacing 180–220ms
        await sleep(180 + Math.floor(Math.random() * 41));
        try {
          const items = await fetchPlaylistItems(pl.external_id, 1);
          localCalls += 1; // approx one API call per playlist (1 page)
          const MAX_ITEMS = 200;
          for (let k = 0; k < Math.min(items.length, MAX_ITEMS); k++) {
            const mapped = mapItemToTrackAndLink(pl.id, items[k], k + 1);
            if (mapped) {
              tracksBuf.push(mapped.track);
              // We'll set link.track_id by later join after upsert (not available here). For now, persistence will rely on unique external_id to map.
              linksBuf.push({ playlist_id: pl.id, external_id: mapped.track.external_id, position: mapped.link.position });
            }
          }
        } catch (e) {
          // continue on errors
        }
        processed++;
        apiCalls++;
        if (processed % 1000 === 0) {
          console.log(`[tracks] ⏱ progress: ${processed}/${total} playlists fetched`);
        }
        if (localCalls % 300 === 0) {
          await sleep(2000 + Math.floor(Math.random() * 1001));
        }
        // Periodic flush to DB for this worker
        if (tracksBuf.length >= 1000 || i === slice.length - 1 || stopped) {
          if (tracksBuf.length) {
            await upsertTracksSafe(tracksBuf, 500);
            // Resolve external_id→id mapping for links, then upsert playlist_tracks
            const ids = Array.from(new Set(linksBuf.map(l => l.external_id)));
            const map = new Map();
            // Resolve in chunks
            for (let t = 0; t < ids.length; t += 500) {
              const chunk = ids.slice(t, t + 500);
              const { data, error } = await supabase
                .from('tracks')
                .select('id,external_id')
                .in('external_id', chunk);
              if (!error && data) {
                for (const r of data) map.set(r.external_id, r.id);
              }
              await sleep(50);
            }
            const linkRows = linksBuf
              .map(l => ({ playlist_id: l.playlist_id, track_id: map.get(l.external_id), position: l.position }))
              .filter(x => x.track_id);
            if (linkRows.length) await upsertPlaylistTracksSafe(linkRows, 500);
          }
          tracksBuf.length = 0;
          linksBuf.length = 0;
        }
      }
    })());
  }

  await Promise.allSettled(tasks);
  const ms = Date.now() - start;
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  const unitCost = apiCalls; // approx calls
  if (stopped) {
    console.log(`[tracks] ⏹ early-stop: exceeded 20m window at ${processed}/${total}`);
  }
  console.log(`[tracks] ✅ slot ${slot} done in ${mm}m ${ss}s (unitCost=${unitCost})`);
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

  // Warm-up (cron-only)
  warmupSlots.forEach((pattern) => {
    tasks.push(cron.schedule(pattern, async () => {
      console.log(`[scheduler] 🔸 Warm-up job triggered (${pattern} ${TZ})`);
      try { await prepareWarmupSlot(new Date()); } catch (e) { console.warn('[warmup] ⚠️ prepare error:', e?.message || String(e)); }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Warm-up job active at ${pattern} (${TZ})`);
  });

  // Tracks (cron-only)
  trackFetchSlots.forEach((pattern) => {
    tasks.push(cron.schedule(pattern, async () => {
      console.log(`[scheduler] 🎵 Track-fetch job triggered (${pattern} ${TZ})`);
      try { await processTrackFetchSlot(new Date()); } catch (e) { console.warn('[tracks] ⚠️ track-fetch error:', e?.message || String(e)); }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Track-fetch job active at ${pattern} (${TZ})`);
  });

  // Purge-tracks daily at 19:00 (cron-only)
  const purgePattern = '0 19 * * *';
  tasks.push(cron.schedule(purgePattern, async () => {
    console.log(`[scheduler] 🧹 purge-tracks job triggered (${purgePattern} Europe/Budapest)`);
    try { await runPurgeTracks(); } catch (e) { console.warn('[purge-tracks] ⚠️ error:', e?.message || String(e)); }
  }, { timezone: TZ }));
  console.log(`[scheduler] ⏰ Purge-tracks job active at ${purgePattern} (${TZ})`);

  console.log(`[scheduler] ✅ cron set (${TZ}):\n  - playlists@09:05→18:35 (every 30 min)\n  - warm-up@19:15→04:15 (every 60 min)\n  - tracks@19:30→04:30 (every 60 min)`);
  console.log(`[scheduler] ✅ nightly warm-up@19:25→04:25 & tracks@19:30→04:30 (every 30 min)`);
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
