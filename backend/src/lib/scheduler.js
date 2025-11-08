// backend/src/lib/scheduler.js (reactivated — 6 playlist fetch slots only)
// ✅ Limited schedule: 6 half-hourly playlist discovery runs starting at 09:05 Europe/Budapest
// ⚙️ Safe mode: no warm-up or track-fetch jobs enabled, only controlled playlist discovery.

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

// Only 6 playlist discovery slots (every 30 min from 09:05)
export function startFixedJobs() {
  console.log('✅ [scheduler] Reactivated in limited mode — 6 playlist discovery jobs active.');
  console.log('🕓  Schedule: 09:05, 09:35, 10:05, 10:35, 11:05, 11:35 (Europe/Budapest)');
  console.log('⚙️  Warm-up, fetchTracks, and purge jobs remain disabled.');

  if (_tasks.length) { for (const t of _tasks) { try { t.stop(); } catch {} } _tasks.length = 0; }
  (async () => { try { await loadJobCursor(); } catch {} })();

  const playlistSlots = [
    '5 9 * * *',  '35 9 * * *',
    '5 10 * * *', '35 10 * * *',
    '5 11 * * *', '35 11 * * *'
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
        const nextSlot = (slot + 1) % 6;
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
}

export function stopAllJobs() {
  if (_tasks.length) { for (const t of _tasks) { try { t.stop(); } catch {} } _tasks.length = 0; }
  console.log('🛑 [scheduler] All active tasks stopped manually.');
}
