// ✅ FULL REWRITE — 29-day FETCH + 29-day REFRESH ciklus
// Globalna rotacija regiona + balansirano osvežavanje sadržaja

import { startOfDay } from './utils.js';

export const TIER_CONFIG = {
  GLOBAL: { regions: ['GLOBAL'], pages: 4 },
  A: { regions: ['IN','US','BR','KR','JP','RU','ID','MX','VN'], pages: 3 },
  B: { regions: ['TR','FR','DE','GB','PH','TH','NG','PT','AR','CA'], pages: 3 },
  C: { regions: ['RS','HU','UA','MY','NL','PL','IT','ES','GR','CZ'], pages: 2 },
  D: { regions: ['SE','NO','DK','FI','CN','HK','AE','EG','KE','ZA'], pages: 2 }
};

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

// 🧮 Odredi trenutni dan ciklusa (1-based)
function getCycleDay(now = new Date()) {
  const dayIndex = Math.floor(startOfDay(now).getTime() / (24 * 3600 * 1000));
  return (dayIndex % 58) + 1; // 58 = 29 fetch + 29 refresh
}

/**
 * 📆 Vrati današnji plan:
 * - ako je 1–29: FETCH plan (preuzimanje novih)
 * - ako je 30–58: REFRESH plan (osvežavanje dana 1–29)
 */
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
