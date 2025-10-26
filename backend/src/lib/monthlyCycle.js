// ✅ FULL REWRITE — 29-day FETCH + 29-day REFRESH ciklus
// Globalna rotacija regiona + precizno računanje ciklusa na osnovu CYCLE_START_DATE

import { startOfDay, parseYMD } from './utils.js';

// ───────────────────────────────────────────────────────────────
// 🎯 DEFINICIJA TIER-OVA (regioni po prioritetu)
export const TIER_CONFIG = {
  GLOBAL: { regions: ['GLOBAL'], pages: 4 },
  A: { regions: ['IN','US','BR','KR','JP','RU','ID','MX','VN'], pages: 3 },
  B: { regions: ['TR','FR','DE','GB','PH','TH','NG','PT','AR','CA'], pages: 3 },
  C: { regions: ['RS','HU','UA','MY','NL','PL','IT','ES','GR','CZ'], pages: 2 },
  D: { regions: ['SE','NO','DK','FI','CN','HK','AE','EG','KE','ZA'], pages: 2 }
};

// ───────────────────────────────────────────────────────────────
// 📅 29-dnevna FETCH faza (rotacija regiona)
const VARIANTS_29 = [
  ['A','B','GLOBAL'],
  ['A','C'],
  ['A','B'],
  ['A','B','C'],
  ['A','GLOBAL'],
  ['A','B'],
  ['A','C','GLOBAL'], // Day 7
  ['A','B','D'],
  ['A','B'],
  ['A','C'],
  ['A','GLOBAL'],
  ['A','B'],
  ['A','C','D'],      // Day 13
  ['A','B','GLOBAL'],
  ['A','C'],
  ['A','B','C'],
  ['A','GLOBAL'],
  ['A','B'],
  ['A','C','GLOBAL'], // Day 19
  ['A','B','D'],
  ['A','C'],
  ['A','B'],
  ['A','C','GLOBAL'],
  ['A','B','C'],
  ['A','GLOBAL'],
  ['A','C','D'],
  ['A','B'],
  ['A','B','GLOBAL'], // Day 28
  ['A','C']
];

// ───────────────────────────────────────────────────────────────
// 🧮 Računanje trenutnog dana ciklusa (1–58)
function getCycleDay(now = new Date()) {
  // 📆 Uzimamo CYCLE_START_DATE iz Render environment varijable
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-25';
  const cycleStart = parseYMD(startEnv);

  const diffDays = Math.floor(
    (startOfDay(now).getTime() - startOfDay(cycleStart).getTime()) / (24 * 3600 * 1000)
  );

  // 🔁 Vraća vrednost u opsegu 1–58 (29 fetch + 29 refresh)
  return ((diffDays % 58) + 1);
}

// ───────────────────────────────────────────────────────────────
// 📆 Glavna logika — vraća FETCH ili REFRESH plan za današnji dan
export function pickTodayPlan(now = new Date()) {
  const currentDay = getCycleDay(now);

  if (currentDay <= 29) {
    // 🟣 FETCH faza
    const variant = VARIANTS_29[(currentDay - 1) % VARIANTS_29.length];
    const steps = [];
    for (const tier of variant) {
      const cfg = TIER_CONFIG[tier];
      if (!cfg) continue;
      for (const region of cfg.regions) {
        steps.push({ region, pages: cfg.pages });
      }
    }
    return { mode: 'FETCH', currentDay, steps };
  } else {
    // 🟢 REFRESH faza (npr. day 30 = refresh day 1, day 31 = refresh day 2, itd.)
    const targetDay = ((currentDay - 30) % 29) + 1;
    return { mode: 'REFRESH', currentDay, targetDay };
  }
}
