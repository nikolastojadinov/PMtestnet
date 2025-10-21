import 'dotenv/config';
import { fetchPlaylistsForRegion } from '../services/youtubeService.js';
import { supabase } from '../utils/supabaseClient.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const regionsPath = path.join(__dirname, '..', 'regions.json');
const regions = JSON.parse(await fs.readFile(regionsPath, 'utf-8'));
console.log(`[INFO] [REGIONS] Loaded ${Array.isArray(regions) ? regions.length : 0} regions`);

const FETCH_DAYS = 30;
const FETCH_INTERVAL_MINUTES = 30;
const MAX_REGIONS_PER_TICK = 8;
const COOLDOWN_MINUTES = 60;

let currentMode = 'FETCH';
let currentDay = 1;
let lastRegion = 'IN';
let isLocked = false;

const delay = ms => new Promise(res => setTimeout(res, ms));

async function loadSchedulerState() {
  const { data, error } = await supabase.from('scheduler_state').select('*').limit(1).single();
  if (error && error.code !== 'PGRST116') console.error('[ERROR] Loading state:', error);
  if (data) {
    currentMode = data.mode;
    currentDay = data.day_in_cycle;
    lastRegion = data.last_region;
  } else {
    await supabase.from('scheduler_state').insert({
      mode: 'FETCH', day_in_cycle: 1, last_region: 'IN'
    });
  }
  console.log(`[STATE] Scheduler initialized: day=${currentDay}, mode=${currentMode}, last_region=${lastRegion}`);
}

async function saveSchedulerState() {
  await supabase.from('scheduler_state').update({
    mode: currentMode,
    day_in_cycle: currentDay,
    last_region: lastRegion,
    updated_at: new Date().toISOString()
  }).eq('id', 1);
}

function advanceDay() {
  currentDay++;
  if (currentDay > FETCH_DAYS) {
    currentDay = 1;
    currentMode = currentMode === 'FETCH' ? 'REFRESH' : 'FETCH';
    console.log(`[MODE SWITCH] Switched to ${currentMode} mode`);
  }
}

async function schedulerTick() {
  if (isLocked) return console.warn('[LOCK] Scheduler already running, skipping tick.');
  isLocked = true;
  console.log(`[TICK START] UTC=${new Date().toISOString()}, startRegion=${lastRegion}`);

  const regionIndex = regions.findIndex(r => r === lastRegion);
  const nextRegions = [];
  for (let i = 1; i <= MAX_REGIONS_PER_TICK; i++) {
    const idx = (regionIndex + i) % regions.length;
    nextRegions.push(regions[idx]);
  }

  for (const region of nextRegions) {
    console.log(`[INFO] Fetching region: ${region}`);
    const result = await fetchPlaylistsForRegion(region, currentMode);
    if (result === 'COOLDOWN') {
      console.warn(`[WARN] Quota exhausted — cooldown ${COOLDOWN_MINUTES}min.`);
      await delay(COOLDOWN_MINUTES * 60 * 1000);
      break;
    }
    lastRegion = region;
    await saveSchedulerState();
    await delay(5000);
  }

  advanceDay();
  await saveSchedulerState();
  isLocked = false;
  console.log(`[TICK END] Completed day=${currentDay}, mode=${currentMode}, last_region=${lastRegion}`);
}

(async function startScheduler() {
  console.log(`[INFO] Cron scheduler starting... env=${process.env.NODE_ENV||'unknown'}`);
  await loadSchedulerState();
  while (true) {
    try {
      await schedulerTick();
      await delay(FETCH_INTERVAL_MINUTES * 60 * 1000);
    } catch (err) {
      console.error('[ERROR] Tick failed:', err);
      isLocked = false;
      await delay(60000);
    }
  }
})();
