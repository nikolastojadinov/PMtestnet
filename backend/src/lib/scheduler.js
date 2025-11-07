// backend/src/lib/scheduler.js
// Fully persistent scheduler with auto-category assignment
// - Playlists: 20 slots (09:05→18:35, every 30 min)
// - Warm-up:   10 slots (19:15→04:15, hourly)
// - Tracks:    10 slots (19:30→04:30, hourly)
// - Timezone:  Europe/Budapest
// - Persistence: day/slot resume via job_cursor

import cron from 'node-cron';
import { pickDaySlotList } from './searchSeedsGenerator.js';
import { runSeedDiscovery, runTrackFetchCycle, runWarmupCycle } from './jobs.js';
import { loadJobCursor as loadCursor, saveJobCursor as saveCursor } from './persistence.js';

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

const warmupSlots = [
  '15 19 * * *', '15 20 * * *',
  '15 21 * * *', '15 22 * * *',
  '15 23 * * *', '15 0 * * *',
  '15 1 * * *',  '15 2 * * *',
  '15 3 * * *',  '15 4 * * *',
];

const trackFetchSlots = [
  '30 19 * * *', '30 20 * * *',
  '30 21 * * *', '30 22 * * *',
  '30 23 * * *', '30 0 * * *',
  '30 1 * * *',  '30 2 * * *',
  '30 3 * * *',  '30 4 * * *',
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

// 4) Warm-up and track stubs (kept simple)
async function runPrecheckTasks() {
  console.log('[warmup] 🔸 Precheck tasks executed');
}
async function runTrackFetchCycle() {
  console.log('[tracks] 🎵 Track fetch cycle executed (stub)');
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
      console.log(`[scheduler] 🔸 Warm-up job triggered (${pattern} Europe/Budapest)`);
      try { await runWarmupCycle(cursor.day, cursor.slot); } catch (e) { console.warn('[warmup] ⚠️ precheck error:', e?.message || String(e)); }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Warm-up job active at ${pattern} (${TZ})`);
  });

  // Tracks (cron-only)
  trackFetchSlots.forEach((pattern) => {
    tasks.push(cron.schedule(pattern, async () => {
      console.log(`[scheduler] 🎵 Track-fetch job triggered (${pattern} Europe/Budapest)`);
      try { await runTrackFetchCycle(cursor.day, cursor.slot); console.log(`[scheduler] ✅ Track-fetch completed for ${pattern}`); } catch (e) { console.warn('[tracks] ⚠️ track-fetch error:', e?.message || String(e)); }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Track-fetch job active at ${pattern} (${TZ})`);
  });

  console.log(`[scheduler] ✅ cron set (${TZ}):\n  - playlists@09:05→18:35 (every 30 min)\n  - warm-up@19:15→04:15 (every 60 min)\n  - tracks@19:30→04:30 (every 60 min)`);
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
