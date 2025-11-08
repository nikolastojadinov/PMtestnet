// backend/src/lib/searchSeedsGenerator.js
// Full deterministic 29×6×120 search seeds generator for YouTube playlist discovery
// License: MPL-2.0

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// -----------------------------
// Constants and Axes
// -----------------------------

const GENRES = [
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

const REGIONS = [
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

const LANGUAGES = [
  { name: 'English', token: 'music', key: 'en' },
  { name: 'Spanish', token: 'música', key: 'es' },
  { name: 'Portuguese', token: 'música', key: 'pt' },
  { name: 'French', token: 'musique', key: 'fr' },
  { name: 'German', token: 'Musik', key: 'de' },
  { name: 'Italian', token: 'musica', key: 'it' },
  { name: 'Dutch', token: 'muziek', key: 'nl' },
  { name: 'Polish', token: 'muzyka', key: 'pl' },
  { name: 'Hungarian', token: 'zene', key: 'hu' },
  { name: 'Greek', token: 'μουσική', key: 'el' },
  { name: 'Turkish', token: 'müzik', key: 'tr' },
  { name: 'Russian', token: 'музыка', key: 'ru' },
  { name: 'Serbian', token: 'muzika', key: 'sr' },
  { name: 'Vietnamese', token: 'nhạc', key: 'vi' },
  { name: 'Hindi', token: 'संगीत', key: 'hi' },
  { name: 'Korean', token: '음악', key: 'ko' },
  { name: 'Japanese', token: '音楽', key: 'ja' },
  { name: 'Chinese', token: '音乐', key: 'zh' },
  { name: 'Filipino', token: 'musika', key: 'fil' },
  { name: 'Thai', token: 'เพลง', key: 'th' },
  { name: 'Amharic', token: 'ሙዚቃ', key: 'am' },
  { name: 'Nigerian English', token: 'music', key: 'ng-en' },
];

const MOODS = [
  'chill', 'study', 'focus', 'relax', 'sleep', 'meditation', 'yoga', 'workout', 'gym', 'running',
  'party', 'club', 'dance', 'festival', 'summer', 'beach', 'road trip', 'driving',
  'happy', 'upbeat', 'feel good', 'anthems', 'motivational',
  'romantic', 'love', 'heartbreak', 'sad', 'melancholy', 'nostalgia', 'vintage', 'classics',
  'rainy day', 'coffee shop', 'lounge', 'deep focus', 'background', 'instrumental', 'acoustic',
  'gaming', 'streaming', 'productivity', 'coding', 'ambient', 'cinematic'
];

const DECADES = ['1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020s'];
const TOPICS = ['best of','top hits','greatest hits','new releases','trending','viral','remix','cover','live','acoustic','instrumental','mix','playlist','radio','session','unplugged','classic'];

const TEMPLATES = [
  '{genre} {mood} {token}',
  '{mood} {genre} {region} {token}',
  '{decade} {genre} {topic}',
  '{region} {genre} {token}',
  '{genre} {topic} {region}',
  '{genre} {mood} {topic}',
  '{genre} {region} {decade}',
  '{genre} {mood} {decade}',
  '{genre} {mood} {region} {topic}',
  '{genre} {topic} {token}',
  '{region} {mood} {genre}',
  '{genre} {topic} {decade}'
];

const START_DATE_DEFAULT = process.env.CYCLE_START_DATE || '2025-10-27';

// ------------------------------------------------------------

function bigIntFromHash(h){return BigInt('0x'+h.slice(0,32));}
function mod(n,m){const r=n%m;return r<0?r+m:r;}
function pick(arr,base,step,k){return arr[Number(mod((BigInt(base)+BigInt(step)*BigInt(k)),BigInt(arr.length)))];}
function renderTemplate(tpl,vars){
  return tpl
    .replace('{genre}',vars.genre)
    .replace('{region}',vars.region)
    .replace('{mood}',vars.mood)
    .replace('{token}',vars.language.token)
    .replace('{topic}',vars.topic)
    .replace('{decade}',vars.decade)
    .trim();
}

// ------------------------------------------------------------

export function buildFullCyclePlan(options={}) {
  const cycleStart=options.cycleStart||START_DATE_DEFAULT;
  const plan=[];
  for(let day=1;day<=29;day++){
    for(let slot=0;slot<6;slot++){
      const baseHash=crypto.createHash('sha256').update(`${cycleStart}|${day}|${slot}`).digest('hex');
      const baseBig=bigIntFromHash(baseHash);
      for(let i=0;i<120;i++){
        const genre=pick(GENRES,baseBig,7,i);
        const region=pick(REGIONS,baseBig,11,i);
        const language=pick(LANGUAGES,baseBig,5,i);
        const mood=pick(MOODS,baseBig,13,i);
        const decade=pick(DECADES,baseBig,3,i);
        const topic=pick(TOPICS,baseBig,7,i);
        const tpl=pick(TEMPLATES,baseBig,19,i);
        const query=renderTemplate(tpl,{genre,region,language,mood,decade,topic});
        plan.push({day,slot,idx:i,query,genre,region,language:language.key,mood,decade,topic});
      }
    }
  }
  return plan;
}

export function getDaySlotSeeds(day,slot){
  const plan=buildFullCyclePlan();
  return plan.filter(p=>p.day===day&&p.slot===slot);
}
export function pickDaySlotList(day,slot){
  return getDaySlotSeeds(day,slot).map(p=>p.query);
}
export function verifyFullCycle(){
  const p=buildFullCyclePlan();
  if(p.length!==20880)throw new Error(`Expected 20880, got ${p.length}`);
  console.log('✅ verifyFullCycle PASS',p.length);
}

export function materializePlanToJson(out=path.resolve('backend/src/lib/searchSeedsPlan.json'),options={}){
  const abs=path.resolve(out);
  const plan=buildFullCyclePlan({cycleStart:options.cycleStart});
  fs.mkdirSync(path.dirname(abs),{recursive:true});
  fs.writeFileSync(abs,JSON.stringify(plan,null,2),'utf-8');
  console.log(`Plan written to ${abs} (${plan.length} queries)`);
  return abs;
}

if(import.meta.url===`file://${process.argv[1]}`){
  const argDay=Number(process.argv[2])||1;
  const out=materializePlanToJson();
  for(let slot=0;slot<6;slot++){
    const seeds=getDaySlotSeeds(argDay,slot);
    console.log(`Day ${argDay} slot ${slot} → ${seeds.length} queries`);
  }
}
