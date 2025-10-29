// ✅ FULL REWRITE v4.1 — Unified 29+29 day cycle (auto-refreshing CYCLE_START_DATE)
// Svaki cron ciklus sada u realnom vremenu čita environment, bez keširanja vrednosti

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

// 🔢 Računanje trenutnog dana ciklusa — sada uvek čita svež env
function getCycleDay(now = new Date()) {
  // ♻️ Dinamičko učitavanje CYCLE_START_DATE (bez keširanja)
  const envValue = process.env.CYCLE_START_DATE?.trim();
  const startEnv =
    envValue && /^\d{4}-\d{2}-\d{2}$/.test(envValue)
      ? envValue
      : '2025-10-27'; // fallback
  
  const cycleStart = parseYMD(startEnv);
  const diffDays = Math.floor(
    (startOfDay(now) - startOfDay(cycleStart)) / (24 * 3600 * 1000)
  );

  // 🔁 vraća 1–58 (29 FETCH + 29 REFRESH)
  return ((diffDays % 58) + 1);
}

// 🧮 Glavna logika — FETCH / REFRESH plan za današnji dan
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
    // 🟢 REFRESH faza
    const targetDay = ((currentDay - 30) % 29) + 1;
    return { mode: 'REFRESH', currentDay, targetDay };
  }
}
