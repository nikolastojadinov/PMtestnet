// ✅ FULL REWRITE v5.4 — Simplified permanent 29-day cycle
// 🔹 ZADRŽANO: ciklus 1–29 dana
// 🔹 IZBAČENE grupe A/B/C — sada se regioni rotiraju kroz utils.js
// 🔹 FETCH faza: prvih 29 dana, posle toga zauvek REFRESH

import { startOfDay, parseYMD } from './utils.js';
import { getSupabase } from './supabase.js';

export async function pickTodayPlan(now = new Date()) {
  const sb = getSupabase();
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const cycleStart = parseYMD(startEnv);
  const diffDays = Math.floor((startOfDay(now) - startOfDay(cycleStart)) / (24 * 3600 * 1000));
  const currentDay = ((diffDays % 29) + 1);

  const { data: cfg } = await sb.from('config').select('mode').single();
  const mode = cfg?.mode || 'FETCH';

  if (mode === 'FETCH' && diffDays < 29) return { mode: 'FETCH', currentDay };

  if (mode === 'FETCH' && diffDays >= 29) {
    await sb.from('config')
      .update({ mode: 'REFRESH', current_cycle_start: new Date().toISOString() })
      .eq('id', 1);
    console.log('[cycle] Transition: FETCH → REFRESH (permanent)');
  }

  return { mode: 'REFRESH', currentDay, targetDay: currentDay };
}
