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

export function nextKeyFactory(keys) {
  let i = -1;
  const safe = Array.isArray(keys) ? keys.filter(Boolean) : [];
  return () => {
    if (!safe.length) throw new Error('No API keys provided.');
    i = (i + 1) % safe.length;
    return safe[i];
  };
}

export function pickTodayRegions(n = 10, now = new Date()) {
  const dayIndex = Math.floor(now.getTime() / (24 * 3600 * 1000));
  const start = dayIndex % REGION_POOL.length;
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push(REGION_POOL[(start + k) % REGION_POOL.length]);
  }
  return out;
}

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

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
