// ✅ FULL REWRITE — 29-day Tier plan with balanced global rotation
// Cilj: 60k–70k plejlista mesečno uz pametnu raspodelu regiona

import { startOfDay } from './utils.js';

// ───────────────────────────────────────────────────────────────
// 🎯 DEFINICIJA TIER-OVA
// Tier A = glavni muzički regioni (veći prioritet)
// Tier B = srednje tržište
// Tier C = manja evropska i azijska tržišta
// Tier D = dodatni regioni za raznovrsnost (rotiraju se ređe)

export const TIER_CONFIG = {
  GLOBAL: { regions: ['GLOBAL'], pages: 4 }, // global pretraga
  A: {
    regions: ['IN','US','BR','KR','JP','RU','ID','MX','VN'],
    pages: 3
  },
  B: {
    regions: ['TR','FR','DE','GB','PH','TH','NG','PT','AR','CA'],
    pages: 3
  },
  C: {
    regions: ['RS','HU','UA','MY','NL','PL','IT','ES','GR','CZ'],
    pages: 2
  },
  D: {
    regions: ['SE','NO','DK','FI','CN','HK','AE','EG','KE','ZA'],
    pages: 2
  }
};

// ───────────────────────────────────────────────────────────────
// 📅 29-DNEVNI CIKLUS
// Svaki dan ima kombinaciju Tier-ova (A obavezno, ostali rotiraju).
// GLOBAL ide svaki 3. dan (radi raznolikosti i da izbegnemo overload).

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
// 🧮 GENERATOR DANAŠNJEG PLANA

export function pickTodayPlan(now = new Date()) {
  const dayIndex = Math.floor(startOfDay(now).getTime() / (24 * 3600 * 1000));
  const variant = VARIANTS_29[dayIndex % VARIANTS_29.length];

  const steps = [];
  for (const tier of variant) {
    const cfg = TIER_CONFIG[tier];
    if (!cfg) continue;
    for (const region of cfg.regions) {
      steps.push({ region, pages: cfg.pages });
    }
  }

  return { steps };
}
