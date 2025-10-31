// ✅ FULL REWRITE v3.4 — Smart Region Prioritization + Core Utilities
// 🔹 NOVO: sistem “učenja” regiona (dinamičko ponderisanje uspešnosti)
// 🔹 ZADRŽANO: sve funkcije za datume, rotaciju i sleep()
// 🔹 BEZ promene strukture — potpuno kompatibilno sa starim pozivima

// 🌍 Region pool — identičan kao ranije (70 regiona + GLOBAL)
const REGION_POOL = [
  'US','CA','MX','BR','AR','CL','CO','PE','VE','EC','UY','PY',
  'GB','FR','DE','ES','IT','NL','PL','SE','NO','FI','PT','UA','CZ','HU','RO','GR','RS','HR','BG','CH',
  'TR','SA','AE','EG','NG','KE','ZA','DZ','MA','TN','GH','IQ','IR','IL',
  'IN','PK','BD','VN','PH','TH','MY','ID','KR','JP','HK','SG','TW','CN',
  'AU','NZ','RU','ET','TZ','LK','GLOBAL'
];

// 📈 NOVO: dinamički score sistem za regione (cache u memoriji)
let regionScores = REGION_POOL.reduce((acc, r) => {
  acc[r] = { success: 1, fail: 0, score: 1.0 };
  return acc;
}, {});

// 🔹 Funkcija koju fetchPlaylists.js koristi da “uči” koji region vredi
export function updateRegionScore(region, playlistsCount) {
  if (!regionScores[region]) return;
  if (playlistsCount > 100) regionScores[region].success++;
  else regionScores[region].fail++;
  const total = regionScores[region].success + regionScores[region].fail;
  regionScores[region].score = Math.max(0.1, regionScores[region].success / total);
}

// 🔹 Interna funkcija — vraća regione sortirane po uspešnosti
function weightedShuffle(arr) {
  const weighted = arr.map(r => ({ r, w: regionScores[r]?.score || 0.5 }));
  weighted.sort((a, b) => b.w - a.w);
  return weighted.map(x => x.r);
}

// 🔁 Rotator API ključeva (isto kao pre)
export function nextKeyFactory(keys) {
  let i = -1;
  const safe = Array.isArray(keys) ? keys.filter(Boolean) : [];
  return () => {
    if (!safe.length) throw new Error('No API keys provided.');
    i = (i + 1) % safe.length;
    return safe[i];
  };
}

// 🌍 Pametni odabir regiona za današnji dan (učeni izbor)
export function pickTodayRegions(n = 8, now = new Date()) {
  const dayIndex = Math.floor(now.getTime() / (24 * 3600 * 1000));
  const shuffled = weightedShuffle(REGION_POOL);
  const start = dayIndex % shuffled.length;
  const selected = [];
  for (let k = 0; k < n; k++) selected.push(shuffled[(start + k) % shuffled.length]);
  if (!selected.includes('GLOBAL')) selected.push('GLOBAL');
  return selected;
}

// 📅 Datum, vreme i pomoćne funkcije — nepromenjeno
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

export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
