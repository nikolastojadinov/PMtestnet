// ✅ FULL REWRITE v5.1 — Purple Music Backend entrypoint (fixed cron schedule + correct imports)

import http from 'http';
import supabase from './lib/supabase.js';
import { startFixedJobs } from './lib/scheduler.js';
import { pickTodayPlan } from './lib/monthlyCycle.js';

// ======================================================
// 🚀 Purple Music Backend — Boot Summary
// ======================================================
console.log('==========================================');
console.log('🚀 Purple Music Backend — Boot Summary');
console.log('==========================================');

const envStatus = {
  SUPABASE_URL: !!process.env.SUPABASE_URL ? '✅' : '❌',
  SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE ? '✅' : '❌',
  YOUTUBE_API_KEYS:
    process.env.YOUTUBE_API_KEYS
      ? `✅ (${process.env.YOUTUBE_API_KEYS.split(',').length} keys loaded)`
      : '❌'
};

for (const [key, val] of Object.entries(envStatus)) {
  console.log(` - ${key}: ${val}`);
}
console.log('==========================================');

// ======================================================
// 🧩 Main boot process
// ======================================================
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

  console.log('[startup] Scheduling fixed cron jobs...');
  // Start scheduled jobs (local time): playlists daily, cleanup hourly, tracks hourly
    startFixedJobs();
  console.log('[startup] ✅ Scheduler initialized (local-time schedule)');

    // ======================================================
    // 🩺 Lightweight HTTP server (for /healthz and /info)
    // ======================================================
    const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
        const response = {
          status: 'ok',
          supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE,
          youtubeKeys: process.env.YOUTUBE_API_KEYS
            ? process.env.YOUTUBE_API_KEYS.split(',').length
            : 0,
          uptime: `${Math.round(process.uptime())}s`,
          timestamp: new Date().toISOString()
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
  } else if (req.url === '/info') {
        // Mirror scheduler configuration
  const TZ = process.env.TZ || 'Europe/Budapest';
  const PLAYLIST_SCHEDULE = '5 9 * * *';
    const cycleStart = process.env.CYCLE_START_DATE || '2025-10-27';
    const plan = pickTodayPlan();
        const CLEAN_SCHEDULES = [
          '45 12 * * *',
          '45 13 * * *',
          '45 14 * * *',
          '45 15 * * *',
          '45 16 * * *',
          '45 17 * * *',
          '45 18 * * *',
          '45 19 * * *',
          '45 20 * * *',
          '45 21 * * *',
        ];
        const TRACK_SCHEDULES = [
          '0 13 * * *',
          '0 14 * * *',
          '0 15 * * *',
          '0 16 * * *',
          '0 17 * * *',
          '0 18 * * *',
          '0 19 * * *',
          '0 20 * * *',
          '0 21 * * *',
          '0 22 * * *',
        ];
        const body = {
          version: 'v5.2',
          cron: {
            timezone: TZ,
            playlists: PLAYLIST_SCHEDULE,
            cleanup: CLEAN_SCHEDULES,
            tracks: TRACK_SCHEDULES,
          },
          env: {
            supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE,
            youtubeKeys: process.env.YOUTUBE_API_KEYS ? process.env.YOUTUBE_API_KEYS.split(',').length : 0,
            cycleStartDate: cycleStart,
          },
          cycle: plan,
          uptime: `${Math.round(process.uptime())}s`,
          timestamp: new Date().toISOString(),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Purple Music Backend running.\n');
      }
    });

    const PORT = process.env.PORT || 10000;
    server.listen(PORT, () => {
      console.log(`[server] 🌐 Listening on port ${PORT}`);
    });

    // ======================================================
    // 🕓 Render anti-sleep mechanism (periodic self-ping)
    // ======================================================
    const SELF_URL = process.env.RENDER_EXTERNAL_URL || null;
    if (SELF_URL) {
      console.log(`[keepalive] ⏱️ Active — will ping ${SELF_URL}/healthz every 5 minutes`);
      setInterval(async () => {
        try {
          const res = await fetch(`${SELF_URL}/healthz`);
          if (res.ok) console.log('[keepalive] ✅ Still alive');
        } catch {
          console.warn('[keepalive] ⚠️ Ping failed, continuing...');
        }
      }, 5 * 60 * 1000);
    } else {
      console.log('[keepalive] ⚠️ No RENDER_EXTERNAL_URL detected — skipping self-ping');
    }

    // ======================================================
    // 🧹 Log rotation cleanup
    // ======================================================
    setInterval(() => {
      if (global.gc) global.gc();
      console.log('[maintenance] 🧹 Log heartbeat — uptime', Math.round(process.uptime()), 's');
    }, 10 * 60 * 1000);
  } catch (err) {
    console.error('[startup] ❌ Fatal error during backend boot:', err);
    process.exit(1);
  }
}

main();
