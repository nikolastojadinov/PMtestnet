// backend/src/lib/searchSeedsGenerator.js
// Deterministic, resumable 29×20×100 search seeds plan generator for YouTube playlist discovery
// License: MPL-2.0 (inherits project license)

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// -----------------------------
// Constants and Axes (exact lists from spec)
// -----------------------------

export const GENRES = [
  'Pop', 'Rock', 'Hip Hop', 'Rap', 'R&B', 'Soul', 'Funk', 'Disco', 'Jazz', 'Blues', 'Country',
  'Folk', 'Indie', 'Alternative', 'Metal', 'Heavy Metal', 'Hard Rock', 'Punk', 'Grunge',
  'EDM', 'House', 'Deep House', 'Techno', 'Trance', 'Progressive', 'Drum & Bass', 'Dubstep',
  'Trap', 'Future Bass', 'Electro', 'Dance', 'Eurodance', 'Synthpop', 'New Wave',
  'Classical', 'Baroque', 'Romantic', 'Opera', 'Orchestral', 'Chamber', 'Piano',
  'Instrumental', 'Ambient', 'Chillout', 'Downtempo', 'Lo-fi', 'Chillhop', 'Trip-hop',
  'Reggae', 'Dancehall', 'Ska', 'Afrobeat', 'Afrobeats', 'Highlife', 'Amapiano',
  'K-pop', 'J-pop', 'C-pop', 'T-pop', 'Mandopop', 'Cantopop', 'City Pop',
  'Bollywood', 'Tollywood', 'Kollywood', 'Indian Classical', 'Hindustani', 'Carnatic',
  'Ghazal', 'Qawwali', 'Bhajan', 'Punjabi', 'Bhangra', 'Tamil', 'Telugu', 'Marathi', 'Bengali',
  'Turkish Pop', 'Arab Pop', 'Arabic', 'Rai', 'Maghreb', 'Mahraganat', 'Mizrahi',
  'Latin', 'Reggaeton', 'Bachata', 'Salsa', 'Merengue', 'Cumbia', 'Tango', 'Forró', 'Sertanejo',
  'MPB', 'Bossa Nova', 'Samba', 'Pagode', 'Funk Carioca', 'Baile Funk',
  'Flamenco', 'Fado', 'Chanson', 'Schlager', 'Italo Disco', 'Eurobeat',
  'Greek Laiko', 'Rebetiko', 'Israeli Pop', 'Mizrahi Pop',
  'German Rap', 'UK Drill', 'Grime', 'French Rap', 'Spanish Rap', 'K-hiphop', 'J-hiphop',
  'Gospel', 'Christian', 'Worship', 'Hymns', 'Spiritual', 'Choir',
  'Soundtrack', 'OST', 'Anime Music', 'Game Music', '8-bit', 'Chiptune', 'Synthwave', 'Retrowave',
  'Vaporwave', 'Phonk', 'Hyperpop', 'Shoegaze', 'Dreampop', 'Post-rock', 'Math Rock',
  'Post-punk', 'Emo', 'Screamo', 'Metalcore', 'Death Metal', 'Black Metal', 'Doom Metal',
  'Sludge', 'Stoner', 'Thrash', 'Speed Metal', 'Power Metal', 'Symphonic Metal',
  'Bluegrass', 'Americana', 'Singer-Songwriter', 'Acoustic', 'Unplugged',
  'World', 'Ethnic', 'Celtic', 'Nordic Folk', 'Viking', 'Balkan', 'Turbo-folk',
  'Klezmer', 'Polka', 'Tango Nuevo', 'Bossanova Jazz',
  'House Latino', 'Tribal House', 'Tech House', 'Minimal Techno', 'Detroit Techno',
  'UK Garage', '2-Step', 'Bassline', 'Breakbeat', 'Breaks', 'Big Beat', 'Jungle',
  'IDM', 'Glitch', 'Electro Swing', 'Future House', 'Moombahton', 'Kuduro',
  'Drill', 'Jersey Club', 'Baile Funk Remix', 'Hardstyle', 'Gabber', 'Psytrance', 'Goa Trance',
  'Chillstep', 'Melodic Techno', 'Organic House', 'Afro House', 'Gqom'
];

export const REGIONS = [
  'Global', 'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru',
  'United Kingdom', 'Ireland', 'France', 'Germany', 'Spain', 'Portugal', 'Italy', 'Netherlands', 'Belgium', 'Switzerland', 'Austria',
  'Norway', 'Sweden', 'Denmark', 'Finland', 'Iceland',
  'Poland', 'Czechia', 'Slovakia', 'Hungary', 'Romania', 'Bulgaria', 'Greece', 'Turkey', 'Serbia', 'Croatia', 'Bosnia', 'Slovenia', 'North Macedonia', 'Albania',
  'Russia', 'Ukraine', 'Belarus', 'Lithuania', 'Latvia', 'Estonia',
  'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal',
  'China', 'Japan', 'South Korea', 'Taiwan', 'Hong Kong', 'Philippines', 'Vietnam', 'Thailand', 'Malaysia', 'Indonesia', 'Singapore',
  'Israel', 'Egypt', 'Morocco', 'Tunisia', 'Algeria', 'South Africa', 'Nigeria', 'Ghana', 'Kenya', 'Ethiopia',
  'Australia', 'New Zealand'
];

// Languages with localized word for "music"
export const LANGUAGES = [
  { name: 'English', token: 'music', key: 'en' },
  { name: 'Spanish', token: 'música', key: 'es' },
  { name: 'Portuguese', token: 'música', key: 'pt' },
  { name: 'French', token: 'musique', key: 'fr' },
  { name: 'German', token: 'Musik', key: 'de' },
  { name: 'Italian', token: 'musica', key: 'it' },
  { name: 'Dutch', token: 'muziek', key: 'nl' },
  { name: 'Polish', token: 'muzyka', key: 'pl' },
  { name: 'Czech', token: 'hudba', key: 'cs' },
  { name: 'Hungarian', token: 'zene', key: 'hu' },
  { name: 'Greek', token: 'μουσική', key: 'el' },
  { name: 'Turkish', token: 'müzik', key: 'tr' },
  { name: 'Russian', token: 'музыка', key: 'ru' },
  { name: 'Ukrainian', token: 'музика', key: 'uk' },
  { name: 'Serbian', token: 'muzika', key: 'sr' },
  { name: 'Vietnamese', token: 'nhạc', key: 'vi' },
  { name: 'Hindi', token: 'संगीत', key: 'hi' },
  { name: 'Korean', token: '음악', key: 'ko' },
  { name: 'Japanese', token: '音楽', key: 'ja' },
  { name: 'Chinese', token: '音乐', key: 'zh' },
  { name: 'Indonesian', token: 'musik', key: 'id' },
  { name: 'Filipino', token: 'musika', key: 'fil' },
  { name: 'Thai', token: 'เพลง', key: 'th' },
  { name: 'Amharic', token: 'ሙዚቃ', key: 'am' },
  { name: 'Nigerian English', token: 'music', key: 'ng-en' },
];

export const MOODS = [
  'chill', 'study', 'focus', 'relax', 'sleep', 'meditation', 'yoga', 'workout', 'gym', 'running',
  'party', 'club', 'dance', 'festival', 'summer', 'beach', 'road trip', 'driving',
  'happy', 'upbeat', 'feel good', 'anthems', 'motivational',
  'romantic', 'love', 'heartbreak', 'sad', 'melancholy', 'nostalgia', 'vintage', 'classics',
  'rainy day', 'coffee shop', 'lounge', 'deep focus', 'background', 'instrumental', 'acoustic',
  'gaming', 'streaming', 'productivity', 'coding', 'ambient', 'cinematic'
];

export const DECADES = ['1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

// Years 1970..2025 inclusive
export const YEARS = Array.from({ length: 2025 - 1970 + 1 }, (_, i) => 1970 + i);

export const TOPICS = [
  'best of', 'top hits', 'greatest hits', 'new releases', 'trending', 'viral', 'remix', 'cover', 'live', 'acoustic', 'instrumental',
  'mix', 'megamix', 'compilation', 'playlist', 'radio', 'session', 'unplugged', 'deluxe', 'extended', 'classic'
];

// Templates T1..T12 identifiers and renderers
const TEMPLATES = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'
];

// Step sizes (coprime choices from spec)
const STEPS = {
  genre: 7,
  region: 11,
  lang: 5,
  mood: 13,
  decade: 3,
  year: 17,
  template: 19,
  topic: 7,
};

const START_DATE_DEFAULT = process.env.CYCLE_START_DATE || '2025-10-27';

// -----------------------------
// Normalization and Hashing
// -----------------------------

/**
 * Normalize a query: lowercase, collapse whitespace, strip diacritics.
 * @param {string} q
 * @returns {string}
 */
export function normalize(q) {
  const lower = String(q || '').toLowerCase();
  const noDiacritics = lower.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  return noDiacritics.replace(/\s+/g, ' ').trim();
}

/**
 * Stable hash for a query string.
 * @param {string} q
 * @returns {string} hex sha256
 */
export function hashForQuery(q) {
  return crypto.createHash('sha256').update(String(q)).digest('hex');
}

/**
 * Throws if duplicates exist by raw or normalized string.
 * @param {Array<string|{query:string}>} seeds
 */
export function ensureNoDuplicates(seeds) {
  const seenRaw = new Set();
  const seenNorm = new Set();
  for (const it of seeds) {
    const s = typeof it === 'string' ? it : it?.query;
    if (!s) continue;
    if (seenRaw.has(s)) throw new Error(`Duplicate raw query: ${s}`);
    seenRaw.add(s);
    const n = normalize(s);
    if (seenNorm.has(n)) throw new Error(`Duplicate normalized query: ${s}`);
    seenNorm.add(n);
  }
}

// -----------------------------
// Deterministic Indexing Helpers
// -----------------------------

function bigIntFromHash(h) {
  // take first 16 bytes for a 128-bit number
  const hex = h.slice(0, 32);
  return BigInt('0x' + hex);
}

function mod(n, m) {
  const res = n % m;
  return res < 0 ? res + m : res;
}

function pickIndex(len, base, step, k) {
  return Number(mod((BigInt(base) + BigInt(step) * BigInt(k)), BigInt(len)));
}

// Render based on template and axis picks
function renderQuery(tpl, { genre, lang, region, mood, decade, year, topic }) {
  const musicWord = lang?.token ?? 'music';
  switch (tpl) {
    case 'T1': return { query: `${genre} music`, tags: { category: genre } };
    case 'T2': return { query: `${genre} ${musicWord}`, tags: { category: genre, lang: lang.name } };
    case 'T3': return { query: `${genre} ${decade} music`, tags: { category: genre, decade } };
    case 'T4': return { query: `${genre} ${year} music`, tags: { category: genre, year } };
    case 'T5': return { query: `${mood} ${genre} music`, tags: { category: genre, mood } };
    case 'T6': return { query: `${region} ${genre} music`, tags: { category: genre, region } };
    case 'T7': return { query: `${genre} ${topic} music`, tags: { category: genre, topic } };
    case 'T8': return { query: `${musicWord} ${genre} ${region}`.trim(), tags: { category: genre, lang: lang.name, region } };
    case 'T9': return { query: `${mood} ${decade} ${genre} music`, tags: { category: genre, mood, decade } };
    case 'T10': return { query: `${genre} playlist`, tags: { category: genre } };
    case 'T11': return { query: `${region} ${mood} ${genre} playlist`, tags: { category: genre, region, mood } };
    case 'T12': {
      // Three variants
      const variant = topic || 'hits';
      const q = variant === 'best of' ? `best of ${genre}` : `${genre} ${variant}`;
      return { query: q, tags: { category: genre, topic: variant } };
    }
    default:
      return { query: `${genre} music`, tags: { category: genre } };
  }
}

function templateUses(tpl) {
  return {
    usesYear: tpl === 'T4',
    usesDecade: tpl === 'T3' || tpl === 'T9',
    usesLang: tpl === 'T2' || tpl === 'T8',
    usesRegion: tpl === 'T6' || tpl === 'T8' || tpl === 'T11',
    usesMood: tpl === 'T5' || tpl === 'T9' || tpl === 'T11',
    usesTopic: tpl === 'T7' || tpl === 'T12',
  };
}

function smallestActiveAxis(tpl) {
  // Return axis keys ordered by "smallest" among those used in tpl
  const { usesYear, usesDecade, usesLang, usesRegion, usesMood, usesTopic } = templateUses(tpl);
  const pool = [];
  if (usesDecade) pool.push(['decade', DECADES.length]);
  if (usesYear) pool.push(['year', YEARS.length]);
  if (usesLang) pool.push(['lang', LANGUAGES.length]);
  if (usesMood) pool.push(['mood', MOODS.length]);
  if (usesTopic) pool.push(['topic', TOPICS.length]);
  if (usesRegion) pool.push(['region', REGIONS.length]);
  // Always consider genre last (largest typically)
  pool.push(['genre', GENRES.length]);
  pool.sort((a, b) => a[1] - b[1]);
  return pool.map((x) => x[0]);
}

function clampCaps(slotStats, tpl) {
  const { usesYear, usesDecade, usesTopic } = templateUses(tpl);
  if (usesYear && slotStats.year >= 10) return false;
  if (usesDecade && slotStats.decade >= 20) return false;
  if (usesTopic && slotStats.topic >= 10) return false; // soft upper bound
  return true;
}

// -----------------------------
// Core builder
// -----------------------------

/**
 * Build the entire 29×20×100 plan deterministically.
 * @param {{cycleStart?:string}} [options]
 * @returns {Array<{day:number,slot:number,idx:number,query:string,tags:Record<string,string>}>}
 */
export function buildFullCyclePlan(options = {}) {
  const cycleStart = options.cycleStart || START_DATE_DEFAULT;
  const all = [];
  const seenNorm = new Set();
  const seenRaw = new Set();
  const seenTuple = new Set();

  for (let day = 1; day <= 29; day++) {
    for (let slot = 0; slot < 20; slot++) {
      // Per-slot diversity tracking
      const slotStats = {
        templates: new Map(),
        genres: new Set(),
        regions: new Set(),
        langs: new Set(),
        moods: new Set(),
        decade: 0,
        year: 0,
        topic: 0,
        specials: 0,
      };

      // Precompute base hash for slot
      const baseSeed = crypto.createHash('sha256').update(`${cycleStart}|${day}|${slot}`).digest('hex');
      const baseBig = bigIntFromHash(baseSeed);

      for (let idx = 0; idx < 100; idx++) {
        const seed = crypto.createHash('sha256').update(`${cycleStart}|${day}|${slot}|${idx}`).digest('hex');
        const n = bigIntFromHash(seed);
        const g0 = Number((baseBig + n) % BigInt(GENRES.length));
        const r0 = Number((baseBig >> 7n) % BigInt(REGIONS.length));
        const l0 = Number((baseBig >> 13n) % BigInt(LANGUAGES.length));
        const m0 = Number((baseBig >> 17n) % BigInt(MOODS.length));
        const d0 = Number((baseBig >> 23n) % BigInt(DECADES.length));
        const y0 = Number((baseBig >> 29n) % BigInt(YEARS.length));
        const t0 = Number((baseBig >> 37n) % BigInt(TEMPLATES.length));
        const p0 = Number((baseBig >> 41n) % BigInt(TOPICS.length));

        let pick = {
          genreIdx: pickIndex(GENRES.length, g0, STEPS.genre, idx),
          regionIdx: pickIndex(REGIONS.length, r0, STEPS.region, idx),
          langIdx: pickIndex(LANGUAGES.length, l0, STEPS.lang, idx),
          moodIdx: pickIndex(MOODS.length, m0, STEPS.mood, idx),
          decadeIdx: pickIndex(DECADES.length, d0, STEPS.decade, idx),
          yearIdx: pickIndex(YEARS.length, y0, STEPS.year, idx),
          topicIdx: pickIndex(TOPICS.length, p0, STEPS.topic, idx),
          templateIdx: pickIndex(TEMPLATES.length, t0, STEPS.template, idx),
        };

        // enforce caps and diversity
        let attempt = 0;
        let chosen = null;
        while (attempt < 16) {
          let tpl = TEMPLATES[pick.templateIdx];
          // Cap years/decades/topics per slot
          if (!clampCaps(slotStats, tpl)) {
            // Move to next template that doesn't exceed caps
            pick.templateIdx = (pick.templateIdx + STEPS.template) % TEMPLATES.length;
            attempt++;
            continue;
          }

          const genre = GENRES[pick.genreIdx];
          const region = REGIONS[pick.regionIdx];
          const lang = LANGUAGES[pick.langIdx];
          const mood = MOODS[pick.moodIdx];
          const decade = DECADES[pick.decadeIdx];
          const year = YEARS[pick.yearIdx];
          const topic = TOPICS[pick.topicIdx];

          const { query, tags } = renderQuery(tpl, { genre, region, lang, mood, decade, year, topic });

          const norm = normalize(query);
          const tupleKey = JSON.stringify({ tpl, genre, region, lang: lang.name, mood, decade, year, topic });

          if (!seenNorm.has(norm) && !seenTuple.has(tupleKey)) {
            chosen = { tpl, query, tags: { ...tags } };
            break;
          }

          // Collision: advance smallest active axis deterministically
          const axes = smallestActiveAxis(tpl);
          for (const ax of axes) {
            if (ax === 'decade') pick.decadeIdx = (pick.decadeIdx + STEPS.decade) % DECADES.length;
            else if (ax === 'year') pick.yearIdx = (pick.yearIdx + STEPS.year) % YEARS.length;
            else if (ax === 'lang') pick.langIdx = (pick.langIdx + STEPS.lang) % LANGUAGES.length;
            else if (ax === 'mood') pick.moodIdx = (pick.moodIdx + STEPS.mood) % MOODS.length;
            else if (ax === 'topic') pick.topicIdx = (pick.topicIdx + STEPS.topic) % TOPICS.length;
            else if (ax === 'region') pick.regionIdx = (pick.regionIdx + STEPS.region) % REGIONS.length;
            else if (ax === 'genre') pick.genreIdx = (pick.genreIdx + STEPS.genre) % GENRES.length;
            attempt++;
            if (attempt % 3 === 0) break; // re-render after a few nudges
          }

          if (attempt >= 8) {
            // Switch template to avoid deadlock
            pick.templateIdx = (pick.templateIdx + STEPS.template) % TEMPLATES.length;
          }
        }

        if (!chosen) {
          // As a last resort, force a simple unique variant
          const genre = GENRES[pick.genreIdx];
          const q = `${genre} music ${day}-${slot}-${idx}`;
          chosen = { tpl: 'T1', query: q, tags: { category: genre, forced: '1' } };
        }

  // Update slot stats and global seen
  const nrm = normalize(chosen.query);
  seenNorm.add(nrm);
  seenRaw.add(chosen.query);
        const uses = templateUses(chosen.tpl);
        if (uses.usesDecade && chosen.tags.decade) slotStats.decade++;
        if (uses.usesYear && chosen.tags.year) slotStats.year++;
        if (uses.usesTopic) slotStats.topic++;
        slotStats.templates.set(chosen.tpl, (slotStats.templates.get(chosen.tpl) || 0) + 1);
        if (chosen.tags.category) slotStats.genres.add(chosen.tags.category);
        if (chosen.tags.region) slotStats.regions.add(chosen.tags.region);
        if (chosen.tags.lang) slotStats.langs.add(chosen.tags.lang);
        if (chosen.tags.mood) slotStats.moods.add(chosen.tags.mood);

        seenTuple.add(JSON.stringify({
          tpl: chosen.tpl,
          genre: chosen.tags.category,
          region: chosen.tags.region,
          lang: chosen.tags.lang,
          mood: chosen.tags.mood,
          decade: chosen.tags.decade,
          year: chosen.tags.year,
          topic: chosen.tags.topic,
        }));

        all.push({ day, slot, idx, query: chosen.query, tags: chosen.tags });
      }

      // Minimal deterministic adjustments if constraints are not met
      // Ensure ≥8 templates, ≥12 genres, ≥5 langs, ≥5 regions, ≥6 moods
      const startIdx = (day - 1) * 2000 + slot * 100;
      const slice = all.slice(startIdx, startIdx + 100);
      const tplKinds = new Set(slice.map((x) => detectTplFromQuery(x.query)));
      if (tplKinds.size < 8) {
        enforceTemplateVariety(all, startIdx, day, slot, seenNorm, seenRaw, tplKinds);
      }
      // Diversity bumps for languages/regions/moods/genres
      bumpDiversity(all, startIdx, day, slot, 'langs', LANGUAGES.map(l => l.name), (i) => ({
        next: (i + STEPS.lang) % LANGUAGES.length,
        apply: (item, nextIdx) => {
          const lang = LANGUAGES[nextIdx];
          const tpl = detectTplFromQuery(item.query) || 'T1';
          const { query, tags } = renderQuery(tpl, {
            genre: item.tags.category,
            region: item.tags.region || REGIONS[(i + slot) % REGIONS.length],
            lang,
            mood: item.tags.mood || MOODS[(i + day + slot) % MOODS.length],
            decade: item.tags.decade || DECADES[(i + day) % DECADES.length],
            year: item.tags.year || YEARS[(i + day + slot) % YEARS.length],
            topic: item.tags.topic || TOPICS[(i + slot) % TOPICS.length],
          });
          return { query, tags };
        }
      }), 5, seenNorm, seenRaw);

      bumpDiversity(all, startIdx, day, slot, 'regions', REGIONS, (i) => ({
        next: (i + STEPS.region) % REGIONS.length,
        apply: (item, nextIdx) => {
          const region = REGIONS[nextIdx];
          const tpl = detectTplFromQuery(item.query) || 'T1';
          const { query, tags } = renderQuery(tpl, {
            genre: item.tags.category,
            region,
            lang: LANGUAGES[(i + day) % LANGUAGES.length],
            mood: item.tags.mood || MOODS[(i + day + slot) % MOODS.length],
            decade: item.tags.decade || DECADES[(i + day) % DECADES.length],
            year: item.tags.year || YEARS[(i + day + slot) % YEARS.length],
            topic: item.tags.topic || TOPICS[(i + slot) % TOPICS.length],
          });
          return { query, tags };
        }
      }), 5, seenNorm, seenRaw);

      bumpDiversity(all, startIdx, day, slot, 'moods', MOODS, (i) => ({
        next: (i + STEPS.mood) % MOODS.length,
        apply: (item, nextIdx) => {
          const mood = MOODS[nextIdx];
          const tpl = detectTplFromQuery(item.query) || 'T1';
          const { query, tags } = renderQuery(tpl, {
            genre: item.tags.category,
            region: item.tags.region || REGIONS[(i + slot) % REGIONS.length],
            lang: LANGUAGES[(i + day) % LANGUAGES.length],
            mood,
            decade: item.tags.decade || DECADES[(i + day) % DECADES.length],
            year: item.tags.year || YEARS[(i + day + slot) % YEARS.length],
            topic: item.tags.topic || TOPICS[(i + slot) % TOPICS.length],
          });
          return { query, tags };
        }
      }), 6, seenNorm, seenRaw);

      bumpDiversity(all, startIdx, day, slot, 'genres', GENRES, (i) => ({
        next: (i + STEPS.genre) % GENRES.length,
        apply: (item, nextIdx) => {
          const genre = GENRES[nextIdx];
          const tpl = detectTplFromQuery(item.query) || 'T1';
          const { query, tags } = renderQuery(tpl, {
            genre,
            region: item.tags.region || REGIONS[(i + slot) % REGIONS.length],
            lang: LANGUAGES[(i + day) % LANGUAGES.length],
            mood: item.tags.mood || MOODS[(i + day + slot) % MOODS.length],
            decade: item.tags.decade || DECADES[(i + day) % DECADES.length],
            year: item.tags.year || YEARS[(i + day + slot) % YEARS.length],
            topic: item.tags.topic || TOPICS[(i + slot) % TOPICS.length],
          });
          return { query, tags };
        }
      }), 12, seenNorm, seenRaw);
    }
  }

  // Final global uniqueness check
  ensureNoDuplicates(all);
  return all;
}

function bumpDiversity(all, startIdx, day, slot, key, axisArr, strategy, minDistinct, seenNormGlobal, seenRawGlobal) {
  const slice = all.slice(startIdx, startIdx + 100);
  const set = new Set();
  for (const it of slice) {
    if (key === 'langs' && it.tags.lang) set.add(it.tags.lang);
    else if (key === 'regions' && it.tags.region) set.add(it.tags.region);
    else if (key === 'moods' && it.tags.mood) set.add(it.tags.mood);
    else if (key === 'genres' && it.tags.category) set.add(it.tags.category);
  }
  if (set.size >= minDistinct) return;
  // deterministically adjust a few earliest entries to expand diversity
  for (let i = 0; i < slice.length && set.size < minDistinct; i++) {
    const cur = all[startIdx + i];
    const { next, apply } = strategy(i);
    const { query, tags } = apply(cur, next);
    const norm = normalize(query);
    // avoid duplicates within slot
    if (slice.some((s, j) => j !== i && normalize(s.query) === norm)) continue;
    if (seenNormGlobal && seenNormGlobal.has(norm)) continue;
    if (seenRawGlobal && seenRawGlobal.has(query)) continue;
    all[startIdx + i] = { day, slot, idx: cur.idx, query, tags };
    if (seenNormGlobal) seenNormGlobal.add(norm);
    if (seenRawGlobal) seenRawGlobal.add(query);
    if (key === 'langs' && tags.lang) set.add(tags.lang);
    else if (key === 'regions' && tags.region) set.add(tags.region);
    else if (key === 'moods' && tags.mood) set.add(tags.mood);
    else if (key === 'genres' && tags.category) set.add(tags.category);
  }
}

function detectTplFromQuery(q) {
  const s = q.toLowerCase();
  if (/ best of /.test(' ' + s + ' ') || /\btop hits\b|\bgreatest hits\b|\bhits\b/.test(s)) return 'T12';
  if (/\blive\b|\bremix\b|\bcover\b|\binstrumental\b|\bacoustic\b|\bmegamix\b|\bradio\b|\bsession\b|\bunplugged\b/.test(s)) return 'T7';
  // Playlist variants: T11 if region present, else T10
  if (/\bplaylist\b/.test(s)) {
    const hasRegion = REGIONS.some(r => s.includes(r.toLowerCase()));
    return hasRegion ? 'T11' : 'T10';
  }
  // Year vs decade
  if (/\b\d{4}\b/.test(s)) return 'T4';
  if (/\b1950s\b|1960s|1970s|1980s|1990s|2000s|2010s|2020s/.test(s)) {
    const hasMood = MOODS.some(m => s.includes(m));
    return hasMood ? 'T9' : 'T3';
  }
  // T6: region + genre + music (region at start)
  const startsWithRegion = REGIONS.some(r => s.startsWith(r.toLowerCase() + ' '));
  if (startsWithRegion && /\bmusic\b/.test(s)) return 'T6';
  // T8 vs T2: token position heuristic
  for (const l of LANGUAGES) {
    const tok = l.token.toLowerCase();
    if (s.startsWith(tok + ' ')) return 'T8';
    if (s.includes(' ' + tok + ' ')) return 'T2';
  }
  // Mood+genre+music => T5
  if (/ music /.test(' ' + s + ' ')) {
    const hasMood = MOODS.some(m => s.includes(m));
    return hasMood ? 'T5' : 'T1';
  }
  return 'T1';
}

function enforceTemplateVariety(all, startIdx, day, slot, seenNorm, seenRaw, tplKinds) {
  const slice = all.slice(startIdx, startIdx + 100);
  // Count current templates
  const counts = new Map();
  for (const it of slice) {
    const t = detectTplFromQuery(it.query) || 'T1';
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const missing = TEMPLATES.filter((t) => !tplKinds.has(t));

  // Recalculate current caps
  const cap = { year: slice.filter(x => x.tags.year).length, decade: slice.filter(x => x.tags.decade).length, topic: slice.filter(x => x.tags.topic).length };

  // Sort templates by descending count to choose candidates for replacement
  const sortedTpl = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(x => x[0]);

  for (const need of missing) {
    // find a position with the most common template to flip
    let replaced = false;
    for (const victimTpl of sortedTpl) {
      for (let i = 0; i < slice.length; i++) {
        const cur = slice[i];
        const curTpl = detectTplFromQuery(cur.query) || 'T1';
        if (curTpl !== victimTpl) continue;
        // Build a candidate for the needed template
        const uses = templateUses(need);
        const genre = cur.tags.category || GENRES[(i + day + slot) % GENRES.length];
        const lang = LANGUAGES[(i + day) % LANGUAGES.length];
        const region = REGIONS[(i + slot) % REGIONS.length];
        const mood = MOODS[(i + day + slot) % MOODS.length];
        const decade = DECADES[(i + day) % DECADES.length];
        const year = YEARS[(i + day + slot) % YEARS.length];
        if (uses.usesYear && cap.year >= 10) continue;
        if (uses.usesDecade && cap.decade >= 20) continue;
        const topic = TOPICS[(i + slot) % TOPICS.length];
        const { query, tags } = renderQuery(need, { genre, region, lang, mood, decade, year, topic });
        const norm = normalize(query);
        if (seenNorm.has(norm) || seenRaw.has(query)) continue;
        if (slice.some((s, j) => j !== i && normalize(s.query) === norm)) continue;
        // apply
        all[startIdx + i] = { day, slot, idx: cur.idx, query, tags };
        seenNorm.add(norm);
        seenRaw.add(query);
        tplKinds.add(need);
        if (uses.usesYear) cap.year++;
        if (uses.usesDecade) cap.decade++;
        replaced = true;
        break;
      }
      if (replaced) break;
    }
  }
}

// -----------------------------
// Materialization and Reports
// -----------------------------

/**
 * Write the full 58,000 plan to pretty JSON.
 * @param {string} outPath
 * @param {{force?:boolean, cycleStart?:string}} [options]
 */
export function materializePlanToJson(outPath = path.resolve('backend/src/lib/searchSeedsPlan.json'), options = {}) {
  const abs = path.resolve(outPath);
  if (!options.force && fs.existsSync(abs)) return abs;
  const plan = buildFullCyclePlan({ cycleStart: options.cycleStart });
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(plan, null, 2), 'utf-8');
  return abs;
}

/**
 * Print high-level stats for the full plan.
 */
export function dryRunReport() {
  const plan = buildFullCyclePlan();
  const counts = { category: new Map(), region: new Map(), lang: new Map(), mood: new Map(), decade: new Map(), year: 0 };
  for (const x of plan) {
    const t = x.tags || {};
    if (t.category) counts.category.set(t.category, (counts.category.get(t.category) || 0) + 1);
    if (t.region) counts.region.set(t.region, (counts.region.get(t.region) || 0) + 1);
    if (t.lang) counts.lang.set(t.lang, (counts.lang.get(t.lang) || 0) + 1);
    if (t.mood) counts.mood.set(t.mood, (counts.mood.get(t.mood) || 0) + 1);
    if (t.decade) counts.decade.set(t.decade, (counts.decade.get(t.decade) || 0) + 1);
    if (t.year) counts.year++;
  }
  console.log('Total', plan.length);
  console.log('Unique categories', counts.category.size);
  console.log('Unique regions', counts.region.size);
  console.log('Unique languages', counts.lang.size);
  console.log('Unique moods', counts.mood.size);
  console.log('Decade buckets', counts.decade.size);
  console.log('Year-tagged total', counts.year);
}

// -----------------------------
// Convenience selectors
// -----------------------------

/**
 * Return 100 queries (objects) for a given day/slot.
 * @param {number} day 1..29
 * @param {number} slot 0..19
 */
export function getDaySlotSeeds(day, slot) {
  const plan = buildFullCyclePlan();
  return plan.filter((x) => x.day === day && x.slot === slot);
}

/**
 * Return strings only for a day/slot (100 strings)
 */
export function pickDaySlotList(day, slot) {
  return getDaySlotSeeds(day, slot).map((x) => x.query);
}

/**
 * Return 2,000 strings for given day.
 */
export function pickDailyList(day) {
  const plan = buildFullCyclePlan();
  return plan.filter((x) => x.day === day).map((x) => x.query);
}

/**
 * Verify 58,000 unique and print brief summary.
 */
export function verifyFullCycle() {
  const plan = buildFullCyclePlan();
  if (plan.length !== 58000) throw new Error(`Expected 58000 entries, got ${plan.length}`);
  ensureNoDuplicates(plan);
  const set = new Set(plan.map((x) => normalize(x.query)));
  if (set.size !== 58000) throw new Error('Normalized set size mismatch');
  // Print counts per day
  const perDay = Array.from({ length: 29 }, () => 0);
  for (const p of plan) perDay[p.day - 1]++;
  console.log('verifyFullCycle PASS — per-day counts:', perDay.join(','));
}

// Self-check in development
if (process.env.NODE_ENV === 'development') {
  try { verifyFullCycle(); } catch (e) { console.error('verifyFullCycle FAIL', e?.message); }
}

// -----------------------------
// CLI: node backend/src/lib/searchSeedsGenerator.js [day]
// -----------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const argDay = Number(process.argv[2]) || 1;
  const out = materializePlanToJson(path.resolve('backend/src/lib/searchSeedsPlan.json'));
  console.log(`Plan materialized at: ${out}`);
  // Print 20-line summary
  for (let slot = 0; slot < 20; slot++) {
    const seeds = getDaySlotSeeds(argDay, slot);
    const tplKinds = new Set(seeds.map((x) => detectTplFromQuery(x.query)));
    const genres = new Set(seeds.map((x) => x.tags.category).filter(Boolean));
    const regions = new Set(seeds.map((x) => x.tags.region).filter(Boolean));
    const langs = new Set(seeds.map((x) => x.tags.lang).filter(Boolean));
    const moods = new Set(seeds.map((x) => x.tags.mood).filter(Boolean));
    const years = seeds.filter((x) => x.tags.year).length;
    const decades = seeds.filter((x) => x.tags.decade).length;
    const specials = seeds.filter((x) => x.tags.topic).length;
    console.log(
      `Day ${argDay} slot ${slot}: templates=${tplKinds.size} genres=${genres.size} regions=${regions.size} langs=${langs.size} moods=${moods.size} years=${years} decades=${decades} specials=${specials}`
    );
  }
}
