// ✅ FULL REWRITE v5.1 — Purple Music Backend entrypoint (fixed cron schedule + correct imports)

import http from 'http';
import supabase from './lib/supabase.js';
import { startFixedJobs, stopAllJobs, getCycleDay } from './lib/scheduler.js';
import { verifySupabaseSchema } from './lib/persistence.js';
import { runSeedDiscovery } from './lib/youtube.js';
import { pickDailyList } from './lib/searchSeedsGenerator.js';

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

    // Verify/ensure unique constraints before any upsert occurs
    try {
      await verifySupabaseSchema();
    } catch (e) {
      console.warn('[startup] ⚠️ Schema verification skipped:', e?.message || String(e));
    }

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

    // Kick off an initial discovery for the current day/slot immediately
    try {
      const now = new Date();
      const tz = process.env.TZ || 'Europe/Budapest';
      const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      const [hStr, mStr] = fmt.format(now).split(':');
      const hour = parseInt(hStr, 10);
      const minute = parseInt(mStr, 10);
      let slot;
      if (hour < 13) slot = 0; else if (hour > 22 || (hour === 22 && minute > 30)) slot = 19; else slot = (hour - 13) * 2 + (minute >= 30 ? 1 : 0);
      const day = getCycleDay(now);
      console.log(`[startup] 🔁 Initial seed discovery started (day=${day}, slot=${slot})`);
      // Fire and forget; no await to avoid blocking boot too long
      runSeedDiscovery(day, slot).catch((e) => console.warn('[startup] initial runSeedDiscovery failed:', e?.message || String(e)));
    } catch (e) {
      console.warn('[startup] ⚠️ Could not trigger initial seed discovery:', e?.message || String(e));
    }

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
        const TZ = process.env.TZ || 'Europe/Budapest';
        const body = {
          version: 'v6.0-seeds',
          cron: {
            timezone: TZ,
            seedSlots: '20 slots @ :00/:30 13:00→22:30',
          },
          env: {
            supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE,
            youtubeKeys: process.env.YOUTUBE_API_KEYS ? process.env.YOUTUBE_API_KEYS.split(',').length : 0,
            cycleStartDate: process.env.CYCLE_START_DATE || '2025-10-27',
          },
          seeds: { perDay: 2000, totalCycle: 58000, sampleDay1Count: pickDailyList(1).length },
          uptime: `${Math.round(process.uptime())}s`,
          timestamp: new Date().toISOString(),
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Purple Music Backend (58K search seeds mode) running.\n');
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
    const heartbeat = setInterval(() => {
      if (global.gc) global.gc();
      console.log('[maintenance] 🧹 Log heartbeat — uptime', Math.round(process.uptime()), 's');
    }, 10 * 60 * 1000);

    // ======================================================
    // 🛑 Graceful shutdown
    // ======================================================
    async function shutdown(signal) {
      console.log(`[shutdown] Received ${signal}. Stopping scheduler and server...`);
      try {
        stopAllJobs();
      } catch {}

      // Close server to stop accepting new connections
      await new Promise((resolve) => server.close(() => resolve()))
        .catch(() => {});
      clearInterval(heartbeat);

      // Seeds-only mode: no cursor persistence

      // Give a brief window for in-flight ops (best effort)
      await new Promise((r) => setTimeout(r, 500));
      console.log('[shutdown] Exiting now.');
      process.exit(0);
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    console.error('[startup] ❌ Fatal error during backend boot:', err);
    process.exit(1);
  }
}

main();
