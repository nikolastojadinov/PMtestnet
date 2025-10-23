// ✅ FULL REWRITE — Utility funkcije (datumi, regioni, rotacija ključeva, pauze)

// 🌍 Globalni region pool (rotira se dnevno)
const REGION_POOL = [
  'US','GB','DE','FR','ES','IT','NL','PL','HU','IN','VN','PH','KR','JP','RU',
  'ID','TH','BR','TR','NG','PT','UA','CA','MX','AU','AR','MY','BD','PK','SE'
];

/**
 * 🔁 Rotacija API ključeva (round-robin)
 * Svaki sledeći poziv vraća sledeći ključ u nizu.
 */
export function nextKeyFactory(keys) {
  let i = -1;
  const safe = Array.isArray(keys) ? keys.filter(Boolean) : [];
  return () => {
    if (!safe.length) throw new Error('No API keys provided.');
    i = (i + 1) % safe.length;
    return safe[i];
  };
}

/**
 * 🎯 Odaberi n regiona dnevno (deterministički po datumu)
 * npr. ako je n = 10, svakog dana backend koristi sledećih 10 regiona u ciklusu.
 */
export function pickTodayRegions(n = 10, now = new Date()) {
  const dayIndex = Math.floor(now.getTime() / (24 * 3600 * 1000)); // broj dana od epoch
  const start = dayIndex % REGION_POOL.length;
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push(REGION_POOL[(start + k) % REGION_POOL.length]);
  }
  return out;
}

/**
 * 📅 Parsiranje i pomoćne funkcije za datume
 * parseYMD('2025-10-23') → Date u 00:00 lokalno
 */
export function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid CYCLE_START_DATE: ${s}`);
  }
  return dt;
}

export function startOfDay(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

export function daysSince(start, now = new Date()) {
  const a = startOfDay(start).getTime();
  const b = startOfDay(now).getTime();
  return Math.floor((b - a) / (24 * 3600 * 1000));
}

export function todayLocalISO(now = new Date()) {
  return startOfDay(now).toISOString();
}

/**
 * ⏳ Prozor (from..to) za fetched_on koje pripada target “fetch day” u ciklusu (1..29)
 * Na osnovu environment promenljive CYCLE_START_DATE.
 */
export function dateWindowForCycleDay(day) {
  if (day < 1 || day > 29) throw new Error('day must be 1..29');
  const start = parseYMD(process.env.CYCLE_START_DATE);
  const base = new Date(start);
  base.setDate(base.getDate() + (day - 1)); // Day 1 = start
  const from = startOfDay(base);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * 💤 Sleep helper — asinhrona pauza u milisekundama
 * Koristi se za throttling između API poziva (150–300 ms).
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
