// ✅ Smart dual scheduler — FIXED local times only (no startup runs)
// 🕘 09:05 → playlists | 🕐 13:00 → tracks (Europe/Belgrade)

import cron from 'node-cron';
import { pickTodayPlan } from '../lib/monthlyCycle.js';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runFetchTracks } from '../jobs/fetchTracksFromPlaylist.js';
import { runRefreshPlaylists } from '../jobs/refreshPlaylists.js';
import { runRefreshTracks } from '../jobs/refreshTracksFromPlaylist.js';

// Pokreći isključivo u lokalno vreme (sa DST): Europe/Belgrade
const TZ = 'Europe/Belgrade';

// Fiksni termini (bez konverzije u UTC)
const PLAYLIST_SCHEDULE = '5 9 * * *';  // 09:05 local
const TRACK_SCHEDULE    = '0 13 * * *'; // 13:00 local

function getMode() {
  const plan = pickTodayPlan(new Date());
  return plan.mode === 'REFRESH'
    ? { mode: 'REFRESH', currentDay: plan.currentDay, targetDay: plan.targetDay }
    : { mode: 'FETCH', currentDay: plan.currentDay };
}

export function startDualJobs() {
  // 🎧 Playlists @09:05 local — samo tada!
  cron.schedule(PLAYLIST_SCHEDULE, async () => {
    try {
      const { mode, currentDay, targetDay } = getMode();
      console.log(`[scheduler] 09:05 (${TZ}) → mode=${mode} currentDay=${currentDay}`);
      if (mode === 'FETCH') {
        await runFetchPlaylists({ reason: 'daily-fetch' });
      } else {
        await runRefreshPlaylists({ reason: 'daily-refresh', targetDay });
      }
    } catch (e) {
      console.error('[scheduler] playlists job error:', e);
    }
  }, { timezone: TZ });

  // 🎵 Tracks @13:00 local — samo tada!
  cron.schedule(TRACK_SCHEDULE, async () => {
    try {
      const { mode, currentDay, targetDay } = getMode();
      console.log(`[scheduler] 13:00 (${TZ}) → mode=${mode} currentDay=${currentDay}`);
      if (mode === 'FETCH') {
        await runFetchTracks({ reason: 'daily-tracks' });
      } else {
        await runRefreshTracks({ reason: 'daily-refresh', targetDay });
      }
    } catch (e) {
      console.error('[scheduler] tracks job error:', e);
    }
  }, { timezone: TZ });

  // ⚠️ NEMA više startup auto-run! Ništa se ne pokreće pri deploy-u.
  console.log(`[scheduler] cron set: playlists@09:05 ${TZ}, tracks@13:00 ${TZ} (fixed times only)`);
}
