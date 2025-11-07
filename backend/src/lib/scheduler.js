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
import { loadJobCursor as loadCursor, saveJobCursor as saveCursor } from './persistence.js';
import { log } from './logger.js';
import { prepareWarmupTargets } from './tasks/warmup.js';
import { fetchTracks } from './tasks/fetchTracks.js';

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

// In-module task registry to allow cleanup
const _tasks = [];

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

// 4) Build 72 paired warm-up/fetch slots (every 10 minutes from 19:30)
function buildTenMinuteSlots() {
  const startHour = 19;
  const totalSlots = 72;
  const interval = 10;
  const warmOffset = 2;
  const slots = [];
  let h = startHour; let m = 30;
  const zz = (n) => (n < 10 ? `0${n}` : `${n}`);
  for (let i = 0; i < totalSlots; i++) {
    const fetchMin = zz(m);
    const fetchHour = zz(h);
    const warmMin = zz((m - warmOffset + 60) % 60);
    const warmHour = zz(m < warmOffset ? (h - 1 + 24) % 24 : h);
    slots.push({ warmCron: `${warmMin} ${warmHour} * * *`, fetchCron: `${fetchMin} ${fetchHour} * * *`, label: `${fetchHour}${fetchMin}` });
    m += interval; if (m >= 60) { m -= 60; h = (h + 1) % 24; }
  }
  return slots;
}

// 5) Start scheduler
export function startFixedJobs() {
  // Cleanup any previously scheduled tasks
  if (_tasks.length) { for (const t of _tasks) { try { t.stop(); } catch {} } _tasks.length = 0; }
  // Load cursor for daytime playlist discovery
  (async () => { try { await loadJobCursor(); } catch {} })();

  // Playlists — persistent day/slot progression (cron-only, no auto-run on startup)
  playlistSlots.forEach((pattern) => {
    const t = cron.schedule(pattern, async () => {
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
    }, { timezone: TZ });
    _tasks.push(t);
    console.log(`[scheduler] ⏰ Playlist fetch job active at ${pattern} (${TZ})`);
  });
  // 72-slot warm-up and fetchTracks (stateless, paired)
  for (const s of buildTenMinuteSlots()) {
    const warm = cron.schedule(s.warmCron, async () => {
      log(`[warmup] 🎯 preparing playlists for slot ${s.label}`);
      try { await prepareWarmupTargets(1000); log(`[warmup] ✅ ready for slot ${s.label}`); }
      catch (err) { log(`[warmup] ⚠️ error preparing for slot ${s.label}: ${err?.message || String(err)}`); }
    }, { timezone: TZ });
    const fetcher = cron.schedule(s.fetchCron, async () => {
      log(`[scheduler] ⏱ running fetchTracks slot ${s.label}`);
      try { await fetchTracks(); log(`[scheduler] ✅ slot ${s.label} done`); }
      catch (err) { log(`[scheduler] ❌ slot ${s.label} failed: ${err?.message || String(err)}`); }
    }, { timezone: TZ });
    _tasks.push(warm, fetcher);
    console.log(`[scheduler] ⏰ Warm-up @ ${s.warmCron} | Fetch @ ${s.fetchCron} (${TZ})`);
  }

  // Purge-tracks daily at 19:00 (cron-only)
  const purgePattern = '0 19 * * *';
  const purgeTask = cron.schedule(purgePattern, async () => {
    console.log(`[scheduler] 🧹 purge-tracks job triggered (${purgePattern} Europe/Budapest)`);
    try { await runPurgeTracks(); } catch (e) { console.warn('[purge-tracks] ⚠️ error:', e?.message || String(e)); }
  }, { timezone: TZ });
  _tasks.push(purgeTask);
  console.log(`[scheduler] ⏰ Purge-tracks job active at ${purgePattern} (${TZ})`);

  log(`[scheduler] ✅ 72 slots initialized (every 10 min from 19:30)`);
  log(`[scheduler] 🧩 Warm-up offset: 2 min | TZ: ${TZ}`);
  log(`[startup] build nonce=${Math.floor(Math.random() * 999999)}`);
}

export function stopAllJobs() { if (_tasks.length) { for (const t of _tasks) { try { t.stop(); } catch {} } _tasks.length = 0; } }

// 6) Backward-compatible cycle day helper (needed by index.js for initial seed trigger)
export function getCycleDay(now = new Date()) {
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const [y, m, d] = startEnv.split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const diffDays = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / (24 * 3600 * 1000));
  return ((diffDays % 29) + 29) % 29 + 1; // 1..29
}
