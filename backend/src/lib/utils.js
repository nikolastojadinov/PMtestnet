// ✅ FULL REWRITE v3.1 — Utility funkcije (rotacija regiona, datumi, ključevi, pauze)

// 🌍 Globalni region pool v3.1 — 70 zemalja + GLOBAL feed
const REGION_POOL = [
  // 🌎 North America
  'US','CA','MX',
  // 🌎 South America
  'BR','AR','CL','CO','PE','VE','EC','UY','PY',
  // 🌍 Europe
  'GB','FR','DE','ES','IT','NL','PL','SE','NO','FI','PT','UA','CZ','HU','RO','GR','RS','HR','BG','CH',
  // 🌍 Middle East & Africa
  'TR','SA','AE','EG','NG','KE','ZA','DZ','MA','TN','GH','IQ','IR','IL',
  // 🌏 Asia
  'IN','PK','BD','VN','PH','TH','MY','ID','KR','JP','HK','SG','TW','CN',
  // 🌏 Oceania
  'AU','NZ',
  // 🌍 Others / blends
  'RU','ET','TZ','LK',
  // 🌐 YouTube global feed
  'GLOBAL'
];

// ───────────────────────────────────────────────────────────────
// 🔁 API ključ rotator
export function nextKeyFactory(keys) {
  let i = -1;
  const safe = Array.isArray(keys) ? keys.filter(Boolean) : [];
  return () => {
    if (!safe.length) throw new Error('No API keys provided.');
    i = (i + 1) % safe.length;
    return safe[i];
  };
}

// ───────────────────────────────────────────────────────────────
// 🎲 Helper: Fisher–Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ───────────────────────────────────────────────────────────────
// 🌍 Napredna selekcija regiona za današnji dan
export function pickTodayRegions(n = 24, now = new Date()) {
  const dayIndex = Math.floor(now.getTime() / (24 * 3600 * 1000));
  const rotated = shuffle(REGION_POOL); // nasumična permutacija svakog dana
  const start = dayIndex % rotated.length;

  const selected = [];
  for (let k = 0; k < n; k++) {
    selected.push(rotated[(start + k) % rotated.length]);
  }

  // uvek dodaj GLOBAL ako ga nije uzeo automatski
  if (!selected.includes('GLOBAL')) selected.push('GLOBAL');

  return selected;
}

// ───────────────────────────────────────────────────────────────
// 🗓️ Datum i ciklusi
export function parseYMD(s) {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid CYCLE_START_DATE: ${s}`);
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

// ───────────────────────────────────────────────────────────────
// 🕐 Pauza između poziva (async delay)
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ───────────────────────────────────────────────────────────────
// 📅 Izračunaj ISO vremenski prozor za određeni dan ciklusa (1–29)
export function dateWindowForCycleDay(targetDay) {
  if (!targetDay || targetDay < 1 || targetDay > 29) {
    throw new Error('targetDay mora biti između 1 i 29');
  }

  // 📆 Početak ciklusa iz env promenljive (npr. 2025-10-27)
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const cycleStart = parseYMD(startEnv);

  const from = new Date(cycleStart.getTime() + (targetDay - 1) * 24 * 3600 * 1000);
  const to = new Date(cycleStart.getTime() + targetDay * 24 * 3600 * 1000);

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}
