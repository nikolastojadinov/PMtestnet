// backend/src/lib/scheduler.js
// ✅ Fixed local-time schedule for cloud runtimes
// ✅ Timezone: Europe/Budapest (can override with TZ env)
// ✅ Playlists @ 09:05; Pre-fetch selection @ 23:15→08:15; Tracks @ 23:30→08:30 (all local time)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { selectEmptyPlaylists } from '../jobs/selectEmptyPlaylists.js';
import { runFetchTracksWindow } from '../jobs/fetchTracksFromPlaylists.js';
import { keyPool } from './youtube.js';
import { logDailyReport } from './metrics.js';
import { getJobState, getJobCursor, setJobCursor } from './persistence.js';

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
const CLEAN_SCHEDULES = [
  '15 23 * * *','15 0 * * *','15 1 * * *','15 2 * * *','15 3 * * *',
  '15 4 * * *','15 5 * * *','15 6 * * *','15 7 * * *','15 8 * * *',
];

// 🎵 Track fetch times (30 past the hour from 23:30 → 08:30 local time)
const TRACK_SCHEDULES = [
  '30 23 * * *','30 0 * * *','30 1 * * *','30 2 * * *','30 3 * * *',
  '30 4 * * *','30 5 * * *','30 6 * * *','30 7 * * *','30 8 * * *',
];

export function startFixedJobs() {
  const tasks = [];
  // Playlist fetch windows (20 runs/day at :00 and :30 from 13:00 → 22:30)
  PLAYLIST_CRON_TIMES.forEach((pattern) => {
    tasks.push(cron.schedule(
      pattern,
      async () => {
        console.log(`[scheduler] ${pattern} (${TZ}) → Fetch playlists (window)`);
        await runFetchPlaylists();
      },
      { timezone: TZ }
    ));
    console.log(`[scheduler] ⏰ Playlist fetch job active at ${pattern} (${TZ})`);
  });

  // Pre-fetch selection before track fetch window — select empty playlists (no delete)
  CLEAN_SCHEDULES.forEach((pattern) => {
    tasks.push(cron.schedule(
      pattern,
      async () => {
        console.log(`[scheduler] ${pattern} (${TZ}) → Pre-fetch selection (persisted job_state)`);
        const ids = await selectEmptyPlaylists();
        const count = Array.isArray(ids) ? ids.length : 0;
        console.log(`[scheduler] Pre-fetch persisted (${count} ids).`);
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
  - playlists@13:00→22:30 (every :00 and :30)
  - prefetch@23:15→08:15
  - tracks@23:30→08:30`);

  // Additional clarity logs
  // Playlist job activations logged above per pattern.
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
