// ✅ FULL REWRITE v5.1 — One-time FETCH + Infinite REFRESH loop
// 🔹 29 dana FETCH, zatim beskonačni REFRESH ciklusi
// 🔹 REFRESH day 1 = FETCH day 1, REFRESH day 29 = FETCH day 29
// 🔹 Minimalna logika, 100% pouzdano

import { startOfDay, parseYMD } from './utils.js';

export function pickTodayPlan(now = new Date()) {
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const cycleStart = parseYMD(startEnv);
  const oneDay = 24 * 3600 * 1000;
  const diffDays = Math.floor((startOfDay(now) - startOfDay(cycleStart)) / oneDay);
  // Safe modulo so negative diffs map correctly (e.g. -1 => 29)
  const day = ((diffDays % 29) + 29) % 29 + 1; // 1..29 always
  const preStart = startOfDay(now) < startOfDay(cycleStart);

  // ⏱️ Prvih 29 dana FETCH, posle samo REFRESH
  if (diffDays < 29) return { mode: 'FETCH', currentDay: day, preStart };
  return { mode: 'REFRESH', currentDay: day, targetDay: day, preStart };
}
