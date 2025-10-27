// ✅ FULL REWRITE v4.0 — Unified 29+29 day cycle for Purple Music
// Kombinuje globalne regione, CYCLE_START_DATE i precizan dan ciklusa

import { startOfDay, parseYMD } from './utils.js';

export const TIER_CONFIG = {
  GLOBAL: { regions: ['GLOBAL'], pages: 4 },
  A: { regions: ['IN','US','BR','KR','JP','RU','ID','MX','VN'], pages: 3 },
  B: { regions: ['TR','FR','DE','GB','PH','TH','NG','PT','AR','CA'], pages: 3 },
  C: { regions: ['RS','HU','UA','MY','NL','PL','IT','ES','GR','CZ'], pages: 2 },
  D: { regions: ['SE','NO','DK','FI','CN','HK','AE','EG','KE','ZA'], pages: 2 }
};

// 📅 29-dnevna FETCH faza — balansirana rotacija regiona (A–D + GLOBAL)
const VARIANTS_29 = [
  ['A','B','GLOBAL'],
  ['A','C'],
  ['A','B'],
  ['A','B','C'],
  ['A','GLOBAL'],
  ['A','B'],
  ['A','C','GLOBAL'],
  ['A','B','D'],
  ['A','B'],
  ['A','C'],
  ['A','GLOBAL'],
  ['A','B'],
  ['A','C','D'],
  ['A','B','GLOBAL'],
  ['A','C'],
  ['A','B','C'],
  ['A','GLOBAL'],
  ['A','B'],
  ['A','C','GLOBAL'],
  ['A','B','D'],
  ['A','C'],
  ['A','B'],
  ['A','C','GLOBAL'],
  ['A','B','C'],
  ['A','GLOBAL'],
  ['A','C','D'],
  ['A','B'],
  ['A','B','GLOBAL'],
  ['A','C']
];

// 🔢 Računanje trenutnog dana ciklusa
function getCycleDay(now = new Date()) {
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const cycleStart = parseYMD(startEnv);
  const diffDays = Math.floor((startOfDay(now) - startOfDay(cycleStart)) / (24 * 3600 * 1000));
  return ((diffDays % 58) + 1); // 1–58
}

// 🧮 Glavna logika — FETCH / REFRESH plan za današnji dan
export function pickTodayPlan(now = new Date()) {
  const currentDay = getCycleDay(now);

  if (currentDay <= 29) {
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
    const targetDay = ((currentDay - 30) % 29) + 1;
    return { mode: 'REFRESH', currentDay, targetDay };
  }
}
