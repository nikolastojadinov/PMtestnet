// backend/src/lib/searchSeedsGenerator.js
// Deterministic, resumable 29×6×120 search seeds plan generator for YouTube playlist discovery
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
export const YEARS = Array.from({ length: 2025 - 1970 + 1 }, (_, i) => 1970 + i);
export const TOPICS = ['best of', 'top hits', 'greatest hits', 'new releases', 'trending', 'viral', 'remix', 'cover', 'live', 'acoustic', 'instrumental', 'mix', 'playlist', 'radio', 'session', 'unplugged', 'deluxe', 'extended', 'classic'];

const TEMPLATES = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const STEPS = { genre:7, region:11, lang:5, mood:13, decade:3, year:17, template:19, topic:7 };
const START_DATE_DEFAULT = process.env.CYCLE_START_DATE || '2025-10-27';

// -----------------------------
// Helper functions (unchanged)
// -----------------------------
export function normalize(q){const lower=String(q||'').toLowerCase();const noDiacritics=lower.normalize('NFD').replace(/\p{Diacritic}/gu,'');return noDiacritics.replace(/\s+/g,' ').trim();}
export function hashForQuery(q){return crypto.createHash('sha256').update(String(q)).digest('hex');}
export function ensureNoDuplicates(seeds){const sR=new Set(),sN=new Set();for(const it of seeds){const s=typeof it==='string'?it:it?.query;if(!s)continue;if(sR.has(s))throw new Error(`Duplicate raw query: ${s}`);sR.add(s);const n=normalize(s);if(sN.has(n))throw new Error(`Duplicate normalized query: ${s}`);sN.add(n);}}

function bigIntFromHash(h){return BigInt('0x'+h.slice(0,32));}
function mod(n,m){const r=n%m;return r<0?r+m:r;}
function pickIndex(len,base,step,k){return Number(mod((BigInt(base)+BigInt(step)*BigInt(k)),BigInt(len)));}

// renderQuery, templateUses, smallestActiveAxis, clampCaps stay identical (not repeated here for brevity)

// -----------------------------
// Core builder (6×120)
// -----------------------------
export function buildFullCyclePlan(options={}) {
  const cycleStart=options.cycleStart||START_DATE_DEFAULT;
  const all=[], seenNorm=new Set(), seenRaw=new Set(), seenTuple=new Set();

  for(let day=1;day<=29;day++){
    for(let slot=0;slot<6;slot++){                // ← 6 slots per day
      const slotStats={templates:new Map(),genres:new Set(),regions:new Set(),langs:new Set(),moods:new Set(),decade:0,year:0,topic:0};
      const baseSeed=crypto.createHash('sha256').update(`${cycleStart}|${day}|${slot}`).digest('hex');
      const baseBig=bigIntFromHash(baseSeed);

      for(let idx=0;idx<120;idx++){               // ← 120 queries per slot
        // identical logic for picks, diversity, etc. (unchanged)
        // ...
      }
      // diversity slice window = +120
      const startIdx=(day-1)*720+slot*120;
      const slice=all.slice(startIdx,startIdx+120);
      // identical variety + bump logic
    }
  }
  ensureNoDuplicates(all);
  return all;
}

// -----------------------------
// Convenience selectors + verify
// -----------------------------
export function getDaySlotSeeds(day,slot){const plan=buildFullCyclePlan();return plan.filter(x=>x.day===day&&x.slot===slot);}
export function pickDaySlotList(day,slot){return getDaySlotSeeds(day,slot).map(x=>x.query);}
export function pickDailyList(day){const plan=buildFullCyclePlan();return plan.filter(x=>x.day===day).map(x=>x.query);}

export function verifyFullCycle(){
  const plan=buildFullCyclePlan();
  if(plan.length!==20880)throw new Error(`Expected 20880 entries, got ${plan.length}`);
  ensureNoDuplicates(plan);
  const set=new Set(plan.map(x=>normalize(x.query)));
  if(set.size!==20880)throw new Error('Normalized set size mismatch');
  const perDay=Array.from({length:29},()=>0);
  for(const p of plan)perDay[p.day-1]++;
  console.log('verifyFullCycle PASS — per-day counts:',perDay.join(','));
}

// -----------------------------
// Materialization & CLI
// -----------------------------
export function materializePlanToJson(out=path.resolve('backend/src/lib/searchSeedsPlan.json'),options={}){
  const abs=path.resolve(out);
  if(!options.force&&fs.existsSync(abs))return abs;
  const plan=buildFullCyclePlan({cycleStart:options.cycleStart});
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  fs.writeFileSync(abs,JSON.stringify(plan,null,2),'utf-8');
  return abs;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const argDay=Number(process.argv[2])||1;
  const out=materializePlanToJson();
  console.log(`Plan materialized at: ${out}`);
  for(let slot=0;slot<6;slot++){                 // ← 6 slots printed
    const seeds=getDaySlotSeeds(argDay,slot);
    console.log(`Day ${argDay} slot ${slot} → ${seeds.length} queries`);
  }
}
