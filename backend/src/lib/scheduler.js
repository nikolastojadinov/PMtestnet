// backend/src/lib/scheduler.js
// ✅ Fixed local-time schedule for cloud runtimes
// ✅ Timezone: Europe/Budapest (can override with TZ env)
// ✅ Playlists @ 10:10; Cleanup @ 12:45→21:45; Tracks @ 13:00→22:00 (all local time)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { selectEmptyPlaylists } from '../jobs/selectEmptyPlaylists.js';
import { runFetchTracksWindow } from '../jobs/fetchTracksFromPlaylists.js';
import { keyPool } from './youtube.js';
import { logDailyReport } from './metrics.js';
import { getJobState, getJobCursor, setJobCursor } from './persistence.js';

const TZ = process.env.TZ || 'Europe/Budapest';

// 📥 Daily playlists fetch: 09:05 local time
const PLAYLIST_SCHEDULE = '5 9 * * *';

// 🧹 Cleanup times (:45 from 12:45 → 21:45 local time)
const CLEAN_SCHEDULES = [
  '45 12 * * *','45 13 * * *','45 14 * * *','45 15 * * *','45 16 * * *',
  '45 17 * * *','45 18 * * *','45 19 * * *','45 20 * * *','45 21 * * *',
];

// 🎵 Track fetch times (:00 from 13:00 → 22:00 local time)
const TRACK_SCHEDULES = [
  '0 13 * * *','0 14 * * *','0 15 * * *','0 16 * * *','0 17 * * *',
  '0 18 * * *','0 19 * * *','0 20 * * *','0 21 * * *','0 22 * * *',
];

export function startFixedJobs() {
  const tasks = [];
  // Daily playlist discovery
  tasks.push(cron.schedule(
    PLAYLIST_SCHEDULE,
    async () => {
      console.log(`[scheduler] ${PLAYLIST_SCHEDULE} (${TZ}) → Fetch playlists (daily)`);
      // Daily init/reset window
      keyPool.resetDaily();
      await runFetchPlaylists();
    },
    { timezone: TZ }
  ));

  // Cleanup before track fetch window — select empty playlists (no delete)
  CLEAN_SCHEDULES.forEach((pattern) => {
    tasks.push(cron.schedule(
      pattern,
      async () => {
        console.log(`[scheduler] ${pattern} (${TZ}) → Select empty playlists (persisted job_state)`);
        const ids = await selectEmptyPlaylists();
        const count = Array.isArray(ids) ? ids.length : 0;
        console.log(`[scheduler] Selection persisted (${count} ids).`);
      },
      { timezone: TZ }
    ));
  });

  // Track fetch windows
  TRACK_SCHEDULES.forEach((pattern) => {
    tasks.push(cron.schedule(
      pattern,
      async () => {
        // Load persisted selection and cursor; do not re-select here
        const state = await getJobState('tracks_window_selection');
        const items = Array.isArray(state?.items) ? state.items : [];
        const cur = await getJobCursor('fetch_tracks');
        const pos = cur?.index ?? 0;
        console.log(`[scheduler] ${pattern} (${TZ}) → Fetch tracks (selection=${items.length}, resumeAt=${pos})`);
        if (!items.length && !cur) {
          console.log('[scheduler] No selection and no cursor; skipping this window.');
          return;
        }
        await runFetchTracksWindow();
      },
      { timezone: TZ }
    ));
  });

  console.log(`[scheduler] ✅ cron set (${TZ}):
  - playlists@09:05
  - cleanup@12:45→21:45
  - tracks@13:00→22:00`);

  // Additional clarity logs
  console.log(`[scheduler] ⏰ Playlist fetch job active at ${PLAYLIST_SCHEDULE} (${TZ})`);
  console.log('[scheduler] ✅ YouTube key rotation system integrated and logging to api_usage table.');

  // Daily usage report at 12:40 local time
  tasks.push(cron.schedule(
    '40 12 * * *',
    async () => {
      try {
        const phase = keyPool.phaseReport();
        const date = new Date().toISOString().slice(0,10);
        const payload = { date, totalKeys: keyPool.size(), ...phase, status: 'OK' };
        await logDailyReport(payload);
        console.log('[scheduler] 📊 Daily key usage report stored.');
      } catch (e) {
        console.warn('[scheduler] ⚠️ Failed to store daily key usage report:', e?.message || String(e));
      }
    },
    { timezone: TZ }
  ));

  // Expose simple helpers
  startFixedJobs._tasks = tasks;
}

export async function loadTracksSelection() {
  const state = await getJobState('tracks_window_selection');
  return Array.isArray(state?.items) ? state.items : [];
}

export async function loadTracksCursor() {
  return (await getJobCursor('fetch_tracks')) || null;
}

export async function saveTracksCursor(cursor) {
  return setJobCursor('fetch_tracks', cursor);
}

export function markWindowDone() {
  // lifecycle of selection is managed by the selector job; nothing to do here
  return true;
}

export function stopAllJobs() {
  if (Array.isArray(startFixedJobs._tasks)) {
    for (const t of startFixedJobs._tasks) {
      try { t.stop(); } catch {}
    }
  }
}
