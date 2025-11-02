// backend/src/lib/utils.js
// ✅ Core utils + 70-region pool + key rotator

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startOfDay(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t;
}

export function parseYMD(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) throw new Error(`Invalid CYCLE_START_DATE: ${s}`);
  return dt;
}

// Return [from, to) UTC window boundaries for a given cycle day (1..29)
export function dateWindowForCycleDay(day, now = new Date()) {
  if (!day || day < 1 || day > 29) throw new Error('cycle day must be 1..29');
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const start = startOfDay(parseYMD(startEnv));
  const base = new Date(start.getTime() + (day - 1) * 24 * 3600 * 1000);
  const from = startOfDay(base).toISOString();
  const to = new Date(startOfDay(base).getTime() + 24 * 3600 * 1000).toISOString();
  return { from, to };
}

export const REGION_POOL = [
  'US','CA','MX','BR','AR','CL','CO','PE','VE','EC','UY','PY',
  'GB','FR','DE','ES','IT','NL','PL','SE','NO','FI','PT','UA','CZ','HU','RO','GR','RS','HR','BG','CH',
  'TR','SA','AE','EG','NG','KE','ZA','DZ','MA','TN','GH','IQ','IR','IL',
  'IN','PK','BD','VN','PH','TH','MY','ID','KR','JP','HK','SG','TW','CN',
  'AU','NZ','RU','ET','TZ','LK','GLOBAL'
]; // 70 ukupno, uključuje GLOBAL

let regionScores = REGION_POOL.reduce((acc, r) => {
  acc[r] = { success: 1, fail: 0, score: 1.0 };
  return acc;
}, {});

export function updateRegionScore(region, playlistsCount) {
  if (!regionScores[region]) return;
  if (playlistsCount > 100) regionScores[region].success++;
  else regionScores[region].fail++;
  const total = regionScores[region].success + regionScores[region].fail;
  regionScores[region].score = Math.max(0.1, regionScores[region].success / total);
}

function weightedShuffle(arr) {
  const weighted = arr.map(r => ({ r, w: regionScores[r]?.score || 0.5 }));
  weighted.sort((a, b) => b.w - a.w);
  return weighted.map(x => x.r);
}

export function pickTodayRegions(n = 8, now = new Date()) {
  const dayIndex = Math.floor(now.getTime() / (24 * 3600 * 1000));
  const shuffled = weightedShuffle(REGION_POOL);
  const start = dayIndex % shuffled.length;
  const selected = [];
  for (let k = 0; k < n; k++) selected.push(shuffled[(start + k) % shuffled.length]);
  if (!selected.includes('GLOBAL')) selected.push('GLOBAL');
  return selected;
}

export function nextKeyFactory(keys) {
  let i = -1;
  const safe = Array.isArray(keys) ? keys.filter(Boolean) : [];
  return () => {
    if (!safe.length) throw new Error('No API keys provided.');
    i = (i + 1) % safe.length;
    return safe[i];
  };
}
