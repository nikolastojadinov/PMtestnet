// backend/src/lib/utils.js
// ✅ Core utils + region pool + key rotator + smarter selection helpers

// monthlyCycle removed in seeds-only architecture; compute cycle day locally

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

// Return cycle day (1..29) from monthlyCycle plan
export function getCycleDay(now = new Date()) {
  const startEnv = process.env.CYCLE_START_DATE || '2025-10-27';
  const start = startOfDay(parseYMD(startEnv));
  const diffDays = Math.floor((startOfDay(now) - start) / (24 * 3600 * 1000));
  return ((diffDays % 29) + 29) % 29 + 1;
}

// Filter regions to top 40 by score; keep GLOBAL at the end as fallback
export function filterTopRegions(regions, scoreMap = regionScores) {
  const arr = (regions || []).filter(Boolean);
  const globalIdx = arr.indexOf('GLOBAL');
  const withoutGlobal = arr.filter((r) => r !== 'GLOBAL');
  const scored = withoutGlobal.map((r) => ({ r, w: scoreMap[r]?.score ?? 0.5 }));
  scored.sort((a, b) => b.w - a.w);
  const top = scored.slice(0, 40).map((x) => x.r);
  if (globalIdx >= 0) top.push('GLOBAL');
  return top;
}

// Deterministically select 12 categories out of provided list for given day
export function selectCategoriesForDay(allCategories = [], day = getCycleDay()) {
  const N = 12;
  const arr = Array.from(allCategories);
  if (arr.length <= N) return arr;
  const start = (day - 1) % arr.length;
  const out = [];
  for (let i = 0; i < N; i++) out.push(arr[(start + i) % arr.length]);
  return out;
}

export function pickTodayRegions(n = 8, now = new Date()) {
  const dayIndex = Math.floor(now.getTime() / (24 * 3600 * 1000));
  // First filter to top regions by historical score
  const candidate = filterTopRegions(REGION_POOL);
  const shuffled = weightedShuffle(candidate);
  const start = dayIndex % shuffled.length;
  const selected = [];
  for (let k = 0; k < n; k++) selected.push(shuffled[(start + k) % shuffled.length]);
  // Ensure GLOBAL is present once as fallback
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
