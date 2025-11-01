// ✅ FULL REWRITE v4.1 — Boot-time environment summary and startup logger

import supabase from './lib/supabase.js';
import { getNextApiKey } from './lib/youtube.js';
import { startDualJobs } from './lib/scheduler.js';

console.log('==========================================');
console.log('🚀 Purple Music Backend — Boot Summary');
console.log('==========================================');

// 🔍 Safe environment check (without exposing secrets)
const envStatus = {
  SUPABASE_URL: !!process.env.SUPABASE_URL ? '✅' : '❌',
  SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE ? '✅' : '❌',
  YOUTUBE_API_KEYS:
    process.env.YOUTUBE_API_KEYS
      ? `✅ (${process.env.YOUTUBE_API_KEYS.split(',').length} keys loaded)`
      : '❌'
};

console.log('Environment status:');
for (const [key, val] of Object.entries(envStatus)) {
  console.log(` - ${key}: ${val}`);
}

console.log('==========================================');

// 🧩 Initialization sequence
async function main() {
  try {
    console.log('[startup] Initializing Supabase client...');
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
      console.error('[startup] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
      process.exit(1);
    }

    console.log('[startup] ✅ Supabase client ready');

    if (!process.env.YOUTUBE_API_KEYS) {
      console.warn('[startup] ⚠️ Missing YOUTUBE_API_KEYS — YouTube fetch jobs will be skipped.');
    } else {
      const keyCount = process.env.YOUTUBE_API_KEYS.split(',').length;
      console.log(`[startup] ✅ YouTube API key rotation active (${keyCount} keys)`);
    }

    console.log('[startup] Scheduling cron jobs...');
    // Start the scheduled cleanup and track fetch jobs
    startDualJobs();
    console.log('[startup] ✅ Scheduler initialized');
  } catch (err) {
    console.error('[startup] ❌ Fatal error during backend boot:', err);
    process.exit(1);
  }
}

main();
