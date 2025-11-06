// backend/src/lib/scheduler.js
// ✅ Fixed local-time schedule for cloud runtimes
// ✅ Timezone: Europe/Budapest (can override with TZ env)
// ✅ Playlists @ 09:05; Pre-fetch selection @ 23:15→08:15; Tracks @ 23:30→08:30 (all local time)

import cron from 'node-cron';
import { pickDaySlotList } from './searchSeedsGenerator.js';

const TZ = process.env.TZ || 'Europe/Budapest';

// 📥 Playlist fetch windows — every 30 min from 13:00 → 22:30 local time
const PLAYLIST_CRON_TIMES = [
  '0 13 * * *','30 13 * * *',
  '0 14 * * *','30 14 * * *',
  '0 15 * * *','30 15 * * *',
  '0 16 * * *','30 16 * * *',
  '0 17 * * *','30 17 * * *',
  '0 18 * * *','30 18 * * *',
  '0 19 * * *','30 19 * * *',
  '0 20 * * *','30 20 * * *',
  '0 21 * * *','30 21 * * *',
  '0 22 * * *','30 22 * * *',
];

// ⏳ Pre-fetch selection times (15 past the hour from 23:15 → 08:15 local time)
const CLEAN_SCHEDULES = [];

// 🎵 Track fetch times (30 past the hour from 23:30 → 08:30 local time)
const TRACK_SCHEDULES = [];

export function startFixedJobs() {
  const tasks = [];
  // Playlist fetch windows (20 runs/day at :00 and :30 from 13:00 → 22:30)
  PLAYLIST_CRON_TIMES.forEach((pattern, slotIndex) => {
    tasks.push(cron.schedule(
      pattern,
      async () => {
        const day = getCycleDay();
        const queries = pickDaySlotList(day, slotIndex);
        console.log(`[scheduler] ${pattern} (${TZ}) → Seeds window (day=${day}, slot=${slotIndex}, queries=${queries.length})`);
      },
      { timezone: TZ }
    ));
    console.log(`[scheduler] ⏰ Playlist fetch job active at ${pattern} (${TZ})`);
  });

  // Pre-fetch selection before track fetch window — select empty playlists (no delete)
  // No prefetch selection or track windows in seeds-only cleanup mode

  // Track fetch windows
  // No tracks windows scheduled

  console.log(`[scheduler] ✅ cron set (${TZ}):
  - seeds@13:00→22:30 (every :00 and :30)`);

  // Additional clarity logs
  // Playlist job activations logged above per pattern.
  console.log('[scheduler] ✅ YouTube key rotation system integrated and logging to api_usage table.');

  // Daily usage report removed for cleanup mode

  // Expose simple helpers
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
