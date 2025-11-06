// backend/src/lib/scheduler.js
// ✅ Full daily scheduler rewrite per directive
// Europe/Budapest local time
// Playlist discovery: 20 slots every 30 min 09:05 → 18:35
// Warm-up / precheck: 10 slots every 60 min 19:15 → 04:15 (next day)
// Track-fetch: 10 slots every 60 min 19:30 → 04:30 (next day)

import cron from 'node-cron';
import { pickDaySlotList } from './searchSeedsGenerator.js';
import { runSeedDiscovery } from './youtube.js';

const TZ = process.env.TZ || 'Europe/Budapest';
process.env.TZ = TZ; // enforce timezone for process

// 1️⃣ Playlist discovery windows (20 slots)
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

// 2️⃣ Warm-up / precheck windows (10 slots)
const warmupSlots = [
  '15 19 * * *', '15 20 * * *',
  '15 21 * * *', '15 22 * * *',
  '15 23 * * *', '15 0 * * *',
  '15 1 * * *',  '15 2 * * *',
  '15 3 * * *',  '15 4 * * *',
];

// 3️⃣ Track-fetch windows (10 slots)
const trackFetchSlots = [
  '30 19 * * *', '30 20 * * *',
  '30 21 * * *', '30 22 * * *',
  '30 23 * * *', '30 0 * * *',
  '30 1 * * *',  '30 2 * * *',
  '30 3 * * *',  '30 4 * * *',
];

// Stubbed warm-up and track-fetch tasks (extend later as logic evolves)
async function runPrecheckTasks() {
  // Placeholder: could verify key quotas, refresh caches, etc.
  console.log('[warmup] 🔸 Precheck tasks executed');
}

async function runTrackFetchCycle() {
  // Placeholder: iterate promoted playlists and fetch tracks if missing
  console.log('[tracks] 🎵 Track fetch cycle executed (stub)');
}

export function startFixedJobs() {
  const tasks = [];

  // Playlist discovery scheduling
  playlistSlots.forEach((pattern, idx) => {
    const slotIndex = idx; // preserve 0..19 for seed plan mapping
    tasks.push(cron.schedule(pattern, async () => {
      const day = getCycleDay();
      const queries = pickDaySlotList(day, slotIndex);
      console.log(`[scheduler] ⏰ Playlist slot trigger ${pattern} (${TZ}) → day=${day} slot=${slotIndex} queries=${queries.length}`);
      try {
        const summary = await runSeedDiscovery(day, slotIndex);
        console.log(`[seedDiscovery] ✅ slot=${slotIndex} discovered=${summary.discovered} inserted=${summary.inserted} promoted=${summary.promoted} tracks=${summary.tracks}`);
      } catch (e) {
        console.warn('[seedDiscovery] ❌ slot failure:', e?.message || String(e));
      }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Playlist fetch job active at ${pattern} (${TZ})`);
  });

  // Warm-up / precheck
  warmupSlots.forEach((pattern) => {
    tasks.push(cron.schedule(pattern, async () => {
      console.log(`[scheduler] 🔸 Warm-up job triggered (${pattern} Europe/Budapest)`);
      try { await runPrecheckTasks(); } catch (e) { console.warn('[warmup] ⚠️ precheck error:', e?.message || String(e)); }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Warm-up job active at ${pattern} (${TZ})`);
  });

  // Track-fetch
  trackFetchSlots.forEach((pattern) => {
    tasks.push(cron.schedule(pattern, async () => {
      console.log(`[scheduler] 🎵 Track-fetch job triggered (${pattern} Europe/Budapest)`);
      try { await runTrackFetchCycle(); console.log(`[scheduler] ✅ Track-fetch completed for ${pattern}`); } catch (e) { console.warn('[tracks] ⚠️ track-fetch error:', e?.message || String(e)); }
    }, { timezone: TZ }));
    console.log(`[scheduler] ⏰ Track-fetch job active at ${pattern} (${TZ})`);
  });

  console.log(`[scheduler] ✅ cron set (${TZ}):\n  - playlists@09:05→18:35 (every 30 min)\n  - warm-up@19:15→04:15 (every 60 min)\n  - tracks@19:30→04:30 (every 60 min)`);

  startFixedJobs._tasks = tasks;
}

export function getCycleDay(now = new Date()) {
  const start = process.env.CYCLE_START_DATE || '2025-10-27';
  const [y,m,d] = start.split('-').map(Number);
  const s = new Date(y,(m||1)-1,d||1);
  const diffDays = Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()) - Date.UTC(s.getFullYear(),s.getMonth(),s.getDate()))/(24*3600*1000));
  return ((diffDays % 29)+29)%29 + 1;
}

export function stopAllJobs() {
  if (Array.isArray(startFixedJobs._tasks)) {
    for (const t of startFixedJobs._tasks) {
      try { t.stop(); } catch {}
    }
  }
}
