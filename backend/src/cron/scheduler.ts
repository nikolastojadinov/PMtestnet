/**
 * Purple Music - Global YouTube Playlist Scheduler
 * -------------------------------------------------
 * Controls:
 *  - 30-day FETCH and REFRESH cycles
 *  - Region rotation for YouTube playlist fetching
 *  - API key rotation and quota cooldowns
 *  - Automatic state persistence via Supabase
 */

import 'dotenv/config';
import { fetchPlaylistsForRegion } from '../services/youtubeService.js';
import { supabase } from '../utils/supabaseClient.js';
import regions from '../config/regions.json' assert { type: 'json' };

// ========== CONFIG ==========
const FETCH_DAYS = 30;              // Number of days per full cycle
const FETCH_INTERVAL_MINUTES = 30;  // Time between ticks
const MAX_REGIONS_PER_TICK = 8;     // How many regions to process per tick
const COOLDOWN_MINUTES = 60;        // Cooldown when all keys exhausted

// ========== STATE ==========
let currentMode = 'FETCH';
let currentDay = 1;
let lastRegion = 'IN';
let isLocked = false;

// Utility delay
const delay = ms => new Promise(res => setTimeout(res, ms));

// ========== LOAD / SAVE STATE ==========

async function loadSchedulerState() {
  const { data, error } = await supabase.from('scheduler_state').select('*').limit(1).single();
  if (error && error.code !== 'PGRST116') console.error('[ERROR] Loading state:', error);
  if (data) {
    currentMode = data.mode;
    currentDay = data.day_in_cycle;
    lastRegion = data.last_region;
  } else {
    await supabase.from('scheduler_state').insert({
      mode: 'FETCH',
      day_in_cycle: 1,
      last_region: 'IN'
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

// ========== MAIN LOGIC ==========

async function schedulerTick() {
  if (isLocked) return console.warn('[LOCK] Scheduler already running, skipping tick.');
  isLocked = true;
  console.log(`[TICK START] UTC=${new Date().toISOString()}, startRegion=${lastRegion}`);

  // Region rotation
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
      console.warn(`[WARN] Quota exhausted — entering ${COOLDOWN_MINUTES}min cooldown.`);
      await delay(COOLDOWN_MINUTES * 60 * 1000);
      break;
    }
    lastRegion = region;
    await saveSchedulerState();
    await delay(5000); // brief pause between regions
  }

  advanceDay();
  await saveSchedulerState();
  isLocked = false;
  console.log(`[TICK END] Completed day=${currentDay}, mode=${currentMode}, last_region=${lastRegion}`);
}

// ========== MAIN LOOP ==========

(async function startScheduler() {
  console.log(`[INFO] Cron scheduler starting in mode=${currentMode}`);
  await loadSchedulerState();

  while (true) {
    try {
      await schedulerTick();
      await delay(FETCH_INTERVAL_MINUTES * 60 * 1000);
    } catch (err) {
      console.error('[ERROR] Scheduler tick failed:', err);
      isLocked = false;
      await delay(60000);
    }
  }
})();
