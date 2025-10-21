// FULL REWRITE — util funkcije (datumi, regioni, rotacija ključeva)

const REGION_POOL = [
  'US','GB','DE','FR','ES','IT','NL','PL','HU','IN','VN','PH','KR','JP','RU',
  'ID','TH','BR','TR','NG','PT','UA','CA','MX','AU','AR','MY','BD','PK','SE'
];

// Rotacija ključeva (round-robin)
export function nextKeyFactory(keys) {
  let i = -1;
  const safe = Array.isArray(keys) ? keys.filter(Boolean) : [];
  return () => {
    if (!safe.length) throw new Error('No API keys provided.');
    i = (i + 1) % safe.length;
    return safe[i];
  };
}

// Odaberi ~10 regiona dnevno
export function pickTodayRegions(n = 10, now = new Date()) {
  const dayIndex = Math.floor(now.getTime() / (24 * 3600 * 1000));
  const start = dayIndex % REGION_POOL.length;
  const out = [];
  for (let k = 0; k < n; k++) out.push(REGION_POOL[(start + k) % REGION_POOL.length]);
  return out;
}

// Datumi
export function parseYMD(s) {
  // 'YYYY-MM-DD' → lokalni datum u 00:00
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid CYCLE_START_DATE: ${s}`);
  return dt;
}
export function startOfDay(d) {
  const t = new Date(d);
  t.setHours(0,0,0,0);
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

// Prozor (from..to) za fetched_on koje pripada target “fetch day” u ciklusu (1..29)
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
