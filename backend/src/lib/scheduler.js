// backend/src/lib/scheduler.js (temporarily suspended — API compliance safe mode)
// ⚠️ All scheduled cron jobs are paused, logic preserved for later reactivation.

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

// 🚫 TEMPORARILY DISABLED: No cron jobs registered
export function startFixedJobs() {
  console.log('🛑 [scheduler] All cron-based jobs temporarily disabled.');
  console.log('ℹ️  Playlist discovery, warm-up, fetchTracks, and purge jobs are paused.');
  console.log('🕓  To reactivate, restore the original cron.schedule sections.');
  // (loadJobCursor still runs so cursor state is updated)
  (async () => { try { await loadJobCursor(); } catch {} })();
}

export function stopAllJobs() {
  if (_tasks.length) { for (const t of _tasks) { try { t.stop(); } catch {} } _tasks.length = 0; }
  console.log('🛑 [scheduler] All active tasks stopped manually.');
}
