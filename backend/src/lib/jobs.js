// backend/src/lib/jobs.js
// Bridge module exposing standardized job entrypoints for scheduler.

import { runSeedDiscovery } from './youtube.js';

// Warm-up placeholder (extend with real checks later)
export async function runWarmupCycle(day, slot) {
  console.log(`[jobs] warmup cycle day=${day} slot=${slot}`);
  return true;
}

// Track fetch placeholder (extend with real track sync logic)
export async function runTrackFetchCycle(day, slot) {
  console.log(`[jobs] track fetch cycle day=${day} slot=${slot}`);
  return true;
}

export { runSeedDiscovery };
