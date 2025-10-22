// ✅ FULL REWRITE — Tier plan + dnevna rotacija kombinacija

import { startOfDay } from './utils.js';

// Definicija TIER-ova i koliko stranica po regionu
export const TIER_CONFIG = {
  GLOBAL: { regions: ['GLOBAL'], pages: 4 },
  A: { regions: ['IN','US','BR','ID','JP','RU','KR','MX','VN'], pages: 3 },
  B: { regions: ['TR','FR','DE','GB','PH','TH','NG','PT','AR','CA'], pages: 3 },
  C: { regions: ['RS','HU','UA','MY','NL','PL','IT','ES','GR','CZ'], pages: 2 },
};

// 8 varijanti koje vrtimo kroz dane → daje raznolikost
const VARIANTS = [
  ['A','B','GLOBAL'],
  ['A','C'],
  ['A','B'],
  ['A','B','C'],
  ['A','GLOBAL'],
  ['A','B'],
  ['A','C','GLOBAL'],
  ['A','B'],
];

// Napravi listu (region, pages) za današnji dan
export function pickTodayPlan(now = new Date()) {
  const dayIndex = Math.floor(startOfDay(now).getTime() / (24*3600*1000));
  const variant = VARIANTS[dayIndex % VARIANTS.length];

  const steps = [];
  for (const tier of variant) {
    const cfg = TIER_CONFIG[tier];
    if (!cfg) continue;
    for (const r of cfg.regions) {
      steps.push({ region: r, pages: cfg.pages });
    }
  }

  return { steps };
}
