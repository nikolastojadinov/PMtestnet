// backend/src/lib/scheduler.js (stabilized + slot-isolation fix)
// - Uses slot-specific keys in job_state (track_targets_<HHMM>)
// - Deferred cron registration to prevent Render memory spike

import cron from 'node-cron';
import { supabase } from './supabase.js';
import { pickDaySlotList } from './searchSeedsGenerator.js';
import { runSeedDiscovery, runPurgeTracks } from './jobs.js';
import { loadJobCursor as loadCursor, saveJobCursor as saveCursor } from './persistence.js';
import { log } from './logger.js';
import { prepareWarmupTargets } from './tasks/warmup.js';
import { fetchTracks } from './tasks/fetchTracks.js';

const TZ = process.env.TZ || 'Europe/Budapest';
process.env.TZ = TZ;

const _tasks = [];
let cursor = { day: 1, slot: 0 };
let cursorReady = false;
let running = false;

function isoNow() { return new Date().toISOString(); }

// Cursor initialization (no resume between restarts)
export async function loadJobCursor() {
  try {
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

export function getCycleDay(now = new Date()) {
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const [y, m, d] = startEnv.split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const diffDays = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / (24 * 3600 * 1000));
  return ((diffDays % 29) + 29) % 29 + 1;
}

// Build 72 paired warm-up/fetch slots (every 10 minutes from 19:30)
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

// Main scheduler entrypoint
export function startFixedJobs() {
  if (_tasks.length) { for (const t of _tasks) { try { t.stop(); } catch {} } _tasks.length = 0; }
  (async () => { try { await loadJobCursor(); } catch {} })();

  // Playlist discovery jobs
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
  playlistSlots.forEach((pattern) => {
    const t = cron.schedule(pattern, async () => {
      if (!cursorReady) await loadJobCursor();
      if (running) { console.log('[scheduler] ⏳ previous slot still running — skipping'); return; }
      running = true;
      const { day, slot } = cursor;
      const queries = pickDaySlotList(day, slot);
      console.log(`[scheduler] ⏰ Playlist slot ${pattern} (${TZ}) → day=${day} slot=${slot} queries=${queries.length}`);
      try {
        const summary = await runSeedDiscovery(day, slot);
        console.log(`[seedDiscovery] ✅ slot=${slot} discovered=${summary.discovered} inserted=${summary.inserted}`);
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

  // Warm-up / Fetch slots (staggered registration)
  const allSlots = buildTenMinuteSlots();
  allSlots.forEach((s, i) => {
    setTimeout(() => {
      const warm = cron.schedule(s.warmCron, async () => {
        log(`[warmup] 🎯 preparing playlists for slot ${s.label}`);
        try { await prepareWarmupTargets(1000, s.label); log(`[warmup] ✅ ready for slot ${s.label}`); }
        catch (err) { log(`[warmup] ⚠️ ${err?.message || err}`); }
      }, { timezone: TZ });
      const fetcher = cron.schedule(s.fetchCron, async () => {
        log(`[scheduler] ⏱ running fetchTracks slot ${s.label}`);
        try { await fetchTracks(s.label); log(`[scheduler] ✅ slot ${s.label} done`); }
        catch (err) { log(`[scheduler] ❌ ${err?.message || err}`); }
      }, { timezone: TZ });
      _tasks.push(warm, fetcher);
      console.log(`[scheduler] ⏰ Warm-up @ ${s.warmCron} | Fetch @ ${s.fetchCron} (${TZ})`);
    }, i * 200); // 200ms stagger
  });

  // Purge-tracks daily job
  const purgePattern = '0 19 * * *';
  const purgeTask = cron.schedule(purgePattern, async () => {
    console.log(`[scheduler] 🧹 purge-tracks job triggered (${purgePattern} ${TZ})`);
    try { await runPurgeTracks(); } catch (e) { console.warn('[purge-tracks] ⚠️ error:', e?.message || String(e)); }
  }, { timezone: TZ });
  _tasks.push(purgeTask);
  console.log(`[scheduler] ⏰ Purge-tracks job active at ${purgePattern} (${TZ})`);

  log(`[scheduler] ✅ 72 slots initialized (every 10 min from 19:30)`);
  log(`[scheduler] 🧩 Warm-up offset: 2 min | TZ: ${TZ}`);
}

export function stopAllJobs() {
  if (_tasks.length) { for (const t of _tasks) { try { t.stop(); } catch {} } _tasks.length = 0; }
}
