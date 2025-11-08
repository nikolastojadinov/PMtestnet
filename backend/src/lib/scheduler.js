// backend/src/lib/scheduler.js (12:55–13:00 active plan)
// ✅ Warm-up starts 12:55 → Fetch starts 13:00 → 20 half-hourly runs
// ✅ Playlist discovery untouched; getCycleDay re-exported for index.js

import cron from 'node-cron';
import { pickDaySlotList } from './searchSeedsGenerator.js';
import { runSeedDiscovery, runPurgeTracks } from './jobs.js';
import { saveJobCursor as saveCursor } from './persistence.js';
import { startWarmupSchedule } from './tasks/warmup.js';
import { startFetchSchedule } from './tasks/fetchTracks.js';

const TZ = process.env.TZ || 'Europe/Budapest';
process.env.TZ = TZ;

let cursor = { day: 1, slot: 0 };
let cursorReady = false;
let running = false;

function isoNow() { return new Date().toISOString(); }

async function loadJobCursor() {
  try {
    const day = getCycleDay(new Date());
    cursor = { day, slot: 0 };
    await saveCursor({ day, slot: 0, last_run: isoNow() }, 'playlist_scheduler');
    console.log(`[cursor] ✅ init day=${day} slot=0`);
    cursorReady = true;
  } catch (e) {
    console.warn('[cursor] ⚠️ init failed — using defaults:', e?.message || String(e));
    cursorReady = true;
  }
}

async function updateJobCursor(day, slot) {
  await saveCursor({ day, slot, last_run: isoNow() }, 'playlist_scheduler');
  cursor = { day, slot };
}

// 🔹 export added for index.js compatibility
export function getCycleDay(now = new Date()) {
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const [y, m, d] = startEnv.split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const diffDays = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
     Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / (24 * 3600 * 1000)
  );
  return ((diffDays % 29) + 29) % 29 + 1;
}

// 🎯 Playlist discovery — 6 half-hourly runs (kept same)
export function startFixedJobs() {
  console.log('✅ [scheduler] Active mode: 6 playlist discovery slots + Warmup/Fetch sync.');
  console.log('🕓  Playlist discovery: 09:05 → 11:35 (6 slots)');
  console.log('🕓  Warm-up: 12:55, 13:25, 13:55, ... (20 slots)');
  console.log('🎵  FetchTracks: 13:00, 13:30, 14:00, ... (20 slots)');

  (async () => { try { await loadJobCursor(); } catch {} })();

  const playlistSlots = [
    '5 9 * * *',  '35 9 * * *',
    '5 10 * * *', '35 10 * * *',
    '5 11 * * *', '35 11 * * *'
  ];

  playlistSlots.forEach((pattern) => {
    cron.schedule(pattern, async () => {
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

    console.log(`[scheduler] ⏰ Playlist discovery job active at ${pattern} (${TZ})`);
  });

  // 🧹 Daily purge job
  cron.schedule('0 19 * * *', async () => {
    console.log(`[scheduler] 🧹 purge-tracks job triggered (19:00 ${TZ})`);
    try { await runPurgeTracks(); } catch (e) { console.warn('[purge-tracks] ⚠️ error:', e?.message || String(e)); }
  }, { timezone: TZ });

  // 🟣 Activate new warm-up and fetch schedulers
  startWarmupSchedule();
  startFetchSchedule();

  console.log('[scheduler] ✅ All schedules initialized.');
}
