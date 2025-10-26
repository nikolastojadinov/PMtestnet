// ✅ FULL REWRITE — Utility funkcije (datumi, regioni, rotacija ključeva, pauze)

// 🌍 Globalni region pool v2.0 — 60 zemalja + global feed (rotira se dnevno)
const REGION_POOL = [
  // 🌎 North America
  'US','CA','MX',
  // 🌎 South America
  'BR','AR','CL','CO','PE','VE',
  // 🌍 Europe
  'GB','FR','DE','ES','IT','NL','PL','SE','NO','FI','PT','UA','CZ','HU','RO','GR',
  // 🌍 Middle East & Africa
  'TR','SA','AE','EG','NG','KE','ZA','DZ','MA',
  // 🌏 Asia
  'IN','PK','BD','VN','PH','TH','MY','ID','KR','JP','HK','SG','TW',
  // 🌏 Oceania
  'AU','NZ',
  // 🌍 Others / global blends
  'RU','IL','IR','IQ','ET','TZ',
  // 🌐 YouTube global feed
  'GLOBAL'
];

// 🔁 Rotacija API ključeva (round-robin)
export function nextKeyFactory(keys) {
  let i = -1;
  const safe = Array.isArray(keys) ? keys.filter(Boolean) : [];
  return () => {
    if (!safe.length) throw new Error('No API keys provided.');
    i = (i + 1) % safe.length;
    return safe[i];
  };
}

// 🎯 Odabir regiona za današnji dan (rotacija po REGION_POOL)
export function pickTodayRegions(n = 10, now = new Date()) {
  const dayIndex = Math.floor(now.getTime() / (24 * 3600 * 1000));
  const start = dayIndex % REGION_POOL.length;
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push(REGION_POOL[(start + k) % REGION_POOL.length]);
  }
  return out;
}

// 📅 Parsiranje YYYY-MM-DD formata
export function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid CYCLE_START_DATE: ${s}`);
  }
  return dt;
}

// 🕐 Početak dana (00:00 lokalno)
export function startOfDay(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

// 📊 Broj dana između dva datuma
export function daysSince(start, now = new Date()) {
  const a = startOfDay(start).getTime();
  const b = startOfDay(now).getTime();
  return Math.floor((b - a) / (24 * 3600 * 1000));
}

// 📆 Danasnji datum u ISO formatu (UTC)
export function todayLocalISO(now = new Date()) {
  return startOfDay(now).toISOString();
}

// ⏸️ Pauza (async sleep)
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 🧮 Utility: Izračunaj ISO vremenski prozor za određeni dan ciklusa (1–29)
export function dateWindowForCycleDay(targetDay) {
  if (!targetDay || targetDay < 1 || targetDay > 29) {
    throw new Error('targetDay mora biti između 1 i 29');
  }

  // 📌 Početak ciklusa (možeš promeniti ako resetuješ ciklus u Supabase)
  const cycleStart = new Date('2025-10-01T00:00:00Z');

  const from = new Date(cycleStart.getTime() + (targetDay - 1) * 24 * 3600 * 1000);
  const to = new Date(cycleStart.getTime() + targetDay * 24 * 3600 * 1000);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
