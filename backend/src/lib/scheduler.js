// ✅ FULL REWRITE — Jedan dnevni job u 11:55 lokalno (09:55 UTC na Renderu)

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runRefreshPlaylists } from '../jobs/refreshPlaylists.js';
import { daysSince, parseYMD, todayLocalISO } from './utils.js';

// 11:55 lokalno = 09:55 UTC
const SCHEDULE = '55 9 * * *';

/**
 * Fazni sistem:
 *  - Day 1 .. 29  -> FETCH (svaki dan u 11:55)
 *  - Day >= 30    -> REFRESH (svaki dan u 11:55), meta-dan = (day - 29) u intervalu 1..29 u ciklusu
 * Env:
 *  - CYCLE_START_DATE = 'YYYY-MM-DD' (dan 1 počinje tada)
 *  - PHASE = 'fetch' | 'refresh' (opciono; automatski prelaz posle 29. dana je garantovan)
 */
export function getPhaseInfo(now = new Date()) {
  const startStr = process.env.CYCLE_START_DATE;
  if (!startStr) throw new Error('Missing CYCLE_START_DATE (YYYY-MM-DD).');

  const start = parseYMD(startStr);
  const day = Math.max(1, daysSince(start, now) + 1);

  // Automatski prelaz posle 29. dana
  let phase = day <= 29 ? 'fetch' : 'refresh';
  const hinted = (process.env.PHASE || '').toLowerCase();
  if (hinted === 'fetch' && day <= 29) phase = 'fetch';
  if (hinted === 'refresh') phase = 'refresh';

  // Target refresh dan 1..29
  let targetDay = null;
  if (phase === 'refresh') {
    const mod = ((day - 30) % 29 + 29) % 29;
    targetDay = mod + 1;
  }

  return { today: todayLocalISO(now), cycleStart: startStr, day, phase, targetDay };
}

export function startDailyJob() {
  cron.schedule(SCHEDULE, async () => {
    const info = getPhaseInfo(new Date());
    try {
      if (info.phase === 'fetch') {
        console.log(`[scheduler] 11:55 → FETCH (day=${info.day})`);
        await runFetchPlaylists({ reason: `daily-11:55-day${info.day}` });
      } else {
        console.log(`[scheduler] 11:55 → REFRESH (day=${info.day}, targetDay=${info.targetDay})`);
        await runRefreshPlaylists({ reason: `daily-11:55-day${info.day}`, targetDay: info.targetDay });
      }
    } catch (e) {
      console.error('[scheduler] job error:', e);
    }
  }, { timezone: 'UTC' });

  const info = getPhaseInfo(new Date());
  console.log(
    `[scheduler] cron set @09:55 UTC (11:55 local); phase=${info.phase}, day=${info.day}${
      info.targetDay ? `, targetDay=${info.targetDay}` : ''
    }`
  );
}

// Ručni pokretači
export async function runFetchNow(reason = 'manual') {
  return runFetchPlaylists({ reason });
}

export async function runRefreshNow(reason = 'manual', targetDay = null) {
  const info = getPhaseInfo(new Date());
  const t = targetDay || info.targetDay;
  if (!t) throw new Error('No targetDay computed for refresh.');
  return runRefreshPlaylists({ reason, targetDay: t });
}
