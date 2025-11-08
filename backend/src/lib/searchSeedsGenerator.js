// backend/src/lib/searchSeedsGenerator.js
// Full deterministic 29×6×120 search seeds generator for YouTube playlist discovery
// License: MPL-2.0

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

import { GENRES, REGIONS, LANGUAGES, MOODS, DECADES, YEARS, TOPICS } from './searchSeedsGenerator.js'; // self-ref if split later

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

function bigIntFromHash(h) { return BigInt('0x' + h.slice(0, 32)); }
function mod(n, m) { const r = n % m; return r < 0 ? r + m : r; }
function pick(arr, base, step, k) {
  return arr[Number(mod((BigInt(base) + BigInt(step) * BigInt(k)), BigInt(arr.length)))];
}

function renderTemplate(tpl, vars) {
  return tpl
    .replace('{genre}', vars.genre)
    .replace('{region}', vars.region)
    .replace('{mood}', vars.mood)
    .replace('{token}', vars.language.token)
    .replace('{topic}', vars.topic)
    .replace('{decade}', vars.decade)
    .trim();
}

export function buildFullCyclePlan(options = {}) {
  const cycleStart = options.cycleStart || START_DATE_DEFAULT;
  const plan = [];

  for (let day = 1; day <= 29; day++) {
    for (let slot = 0; slot < 6; slot++) {
      const baseHash = crypto
        .createHash('sha256')
        .update(`${cycleStart}|${day}|${slot}`)
        .digest('hex');
      const baseBig = bigIntFromHash(baseHash);

      for (let i = 0; i < 120; i++) {
        const genre = pick(GENRES, baseBig, 7, i);
        const region = pick(REGIONS, baseBig, 11, i);
        const language = pick(LANGUAGES, baseBig, 5, i);
        const mood = pick(MOODS, baseBig, 13, i);
        const decade = pick(DECADES, baseBig, 3, i);
        const topic = pick(TOPICS, baseBig, 7, i);
        const tpl = pick(TEMPLATES, baseBig, 19, i);

        const query = renderTemplate(tpl, {
          genre,
          region,
          language,
          mood,
          decade,
          topic
        });

        plan.push({
          day,
          slot,
          idx: i,
          query,
          genre,
          region,
          language: language.key,
          mood,
          decade,
          topic
        });
      }
    }
  }

  return plan;
}

export function getDaySlotSeeds(day, slot) {
  const plan = buildFullCyclePlan();
  return plan.filter(p => p.day === day && p.slot === slot);
}
export function pickDaySlotList(day, slot) {
  return getDaySlotSeeds(day, slot).map(p => p.query);
}
export function verifyFullCycle() {
  const p = buildFullCyclePlan();
  if (p.length !== 20880)
    throw new Error(`Expected 20880, got ${p.length}`);
  console.log('✅ verifyFullCycle PASS', p.length);
}

export function materializePlanToJson(
  out = path.resolve('backend/src/lib/searchSeedsPlan.json'),
  options = {}
) {
  const abs = path.resolve(out);
  const plan = buildFullCyclePlan({ cycleStart: options.cycleStart });
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(plan, null, 2), 'utf-8');
  console.log(`Plan written to ${abs} (${plan.length} queries)`);
  return abs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argDay = Number(process.argv[2]) || 1;
  const out = materializePlanToJson();
  for (let slot = 0; slot < 6; slot++) {
    const seeds = getDaySlotSeeds(argDay, slot);
    console.log(`Day ${argDay} slot ${slot} → ${seeds.length} queries`);
  }
}
