// ✅ FULL REWRITE — Smart dual scheduler (auto FETCH/REFRESH by day cycle)
// 📅 09:05 → playlists | 13:00 → tracks (local time, UTC+2)

import cron from 'node-cron';
import { pickTodayPlan } from '../lib/monthlyCycle.js';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';
import { runRefreshPlaylists } from '../jobs/refreshPlaylists.js';
import { runRefreshTracks } from '../jobs/refreshTracksFromPlaylist.js';

// 09:05 lokalno (UTC+2) = 07:05 UTC
const PLAYLIST_SCHEDULE = '5 7 * * *';
// 13:00 lokalno (UTC+2) = 11:00 UTC
const TRACK_SCHEDULE = '0 11 * * *';

// 🧠 Pomoćna funkcija — bira mod dana automatski
function getMode() {
  const plan = pickTodayPlan(new Date());
  return plan.mode === 'REFRESH'
    ? { mode: 'REFRESH', currentDay: plan.currentDay, targetDay: plan.targetDay }
    : { mode: 'FETCH', currentDay: plan.currentDay };
}

export function startDualJobs() {
  // 🎧 Playlists job @09:05 local
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    try {
      const { mode, currentDay, targetDay } = getMode();
      console.log(`[scheduler] 09:05 → mode=${mode} currentDay=${currentDay}${mode === 'REFRESH' ? ` targetDay=${targetDay}` : ''}`);

      if (mode === 'FETCH') {
        await runFetchPlaylists({ reason: 'daily-fetch' });
      } else {
        await runRefreshPlaylists({ reason: 'daily-refresh', targetDay });
      }
    } catch (e) {
      console.error('[scheduler] playlists job error:', e);
    }
  }, { timezone: 'UTC' });

  // 🎵 Tracks job @13:00 local
  cron.schedule(TRACK_SCHEDULE, async () => {
    try {
      const { mode, currentDay, targetDay } = getMode();
      console.log(`[scheduler] 13:00 → mode=${mode} currentDay=${currentDay}${mode === 'REFRESH' ? ` targetDay=${targetDay}` : ''}`);

      if (mode === 'FETCH') {
        await runFetchTracks({ reason: 'daily-tracks' });
      } else {
        await runRefreshTracks({ reason: 'daily-refresh', targetDay });
      }
    } catch (e) {
      console.error('[scheduler] tracks job error:', e);
    }
  }, { timezone: 'UTC' });

  // 🟢 Startup auto-run fallback (pokreće odmah po startu)
  (async () => {
    try {
      const { mode, currentDay, targetDay } = getMode();
      console.log(`[startup] immediate mode=${mode} currentDay=${currentDay}${mode === 'REFRESH' ? ` targetDay=${targetDay}` : ''}`);

      if (mode === 'FETCH') {
        await runFetchPlaylists({ reason: 'startup-fetch' });
        setTimeout(() => runFetchTracks({ reason: 'startup-followup' }), 5 * 60 * 1000);
      } else {
        await runRefreshPlaylists({ reason: 'startup-refresh', targetDay });
        setTimeout(() => runRefreshTracks({ reason: 'startup-refresh-followup', targetDay }), 5 * 60 * 1000);
      }
    } catch (err) {
      console.error('[startup] initial job error:', err);
    }
  })();

  console.log('[scheduler] cron set: playlists@07:05 UTC (09:05 local), tracks@11:00 UTC (13:00 local)');
}
