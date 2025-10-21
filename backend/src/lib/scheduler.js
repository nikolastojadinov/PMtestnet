// FULL REWRITE — Jedan dnevni job u 09:05 koji poštuje tvoj ciklus

import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runRefreshPlaylists } from '../jobs/refreshPlaylists.js';
import { daysSince, parseYMD, todayLocalISO } from './utils.js';

const SCHEDULE = '5 9 * * *'; // 09:05 lokalno

/**
 * Fazni sistem:
 *  - Day 1 .. 29  -> FETCH (svaki dan u 09:05)
 *  - Day >= 30    -> REFRESH (svaki dan u 09:05), meta-dan = (day - 29) u intervalu 1..29 u ciklusu
 * Env:
 *  - CYCLE_START_DATE = 'YYYY-MM-DD' (dan 1 počinje tada)
 *  - PHASE = 'fetch' | 'refresh' (opciono; automatski prelaz posle 29. dana je garantovan)
 */
export function getPhaseInfo(now = new Date()) {
  const startStr = process.env.CYCLE_START_DATE;
  if (!startStr) throw new Error('Missing CYCLE_START_DATE (YYYY-MM-DD).');

  const start = parseYMD(startStr);             // 00:00 lokalno
  const day = Math.max(1, daysSince(start, now) + 1); // Day 1 = start day

  // Auto prelaz posle 29. dana — PHASE iz env je samo “hint”
  let phase = day <= 29 ? 'fetch' : 'refresh';
  const hinted = (process.env.PHASE || '').toLowerCase();
  if (hinted === 'fetch' && day <= 29) phase = 'fetch';
  if (hinted === 'refresh') phase = 'refresh'; // dozvoljavamo ručni prelaz ranije, ali nikad obrnuto nakon 29

  // Target refresh dan u intervalu 1..29
  let targetDay = null;
  if (phase === 'refresh') {
    const mod = ((day - 30) % 29 + 29) % 29; // 0..28
    targetDay = mod + 1;                     // 1..29
  }

  return {
    today: todayLocalISO(now),
    cycleStart: startStr,
    day,
    phase,
    targetDay, // u refresh fazi: koji “fetch day” se refrešuje
  };
}

export function startDailyJob() {
  cron.schedule(SCHEDULE, async () => {
    const info = getPhaseInfo(new Date());
    try {
      if (info.phase === 'fetch') {
        console.log(`[scheduler] 09:05 → FETCH (day=${info.day})`);
        await runFetchPlaylists({ reason: `daily-09:05-day${info.day}` });
      } else {
        console.log(`[scheduler] 09:05 → REFRESH (day=${info.day}, targetDay=${info.targetDay})`);
        await runRefreshPlaylists({ reason: `daily-09:05-day${info.day}`, targetDay: info.targetDay });
      }
    } catch (e) {
      console.error('[scheduler] job error:', e);
    }
  });

  const info = getPhaseInfo(new Date());
  console.log(`[scheduler] cron set @09:05; phase=${info.phase}, day=${info.day}${info.targetDay ? `, targetDay=${info.targetDay}` : ''}`);
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
