// ✅ FULL REWRITE v5.2 — Purple Music Backend entrypoint (fixed cron schedule + correct imports)

import http from 'http';
import express from 'express';
import cors from 'cors';
import supabase from './lib/supabase.js';
import { startFixedJobs, getCycleDay } from './lib/scheduler.js'; // 🔹 stopAllJobs removed
import { verifySupabaseSchema } from './lib/persistence.js';
import { pickDailyList } from './lib/searchSeedsGenerator.js';
import { paymentsRouter } from './routes/payments.js';
import { createClient } from '@supabase/supabase-js';

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
    startFixedJobs(); // 🔹 Scheduler runs warmup+fetch automatically
    console.log('[startup] ✅ Scheduler initialized (local-time schedule)');

    // ======================================================
    // 🩺 Express HTTP server (health, info, payments)
    // ======================================================
    const app = express();
    const origin = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.FRONTEND_ORIGIN || '*';
    app.use(cors({ origin }));
    app.use(express.json());

    app.get('/healthz', (req, res) => {
      const response = {
        status: 'ok',
        supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE,
        youtubeKeys: process.env.YOUTUBE_API_KEYS
          ? process.env.YOUTUBE_API_KEYS.split(',').length
          : 0,
        uptime: `${Math.round(process.uptime())}s`,
        timestamp: new Date().toISOString()
      };
      res.json(response);
    });

    app.get('/info', (req, res) => {
      const TZ = process.env.TZ || 'Europe/Budapest';
      const body = {
        version: 'v6.0-seeds',
        cron: {
          timezone: TZ,
          seedSlots: '20 slots @ 12:55/13:00 → every 30min',
        },
        env: {
          supabase: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE,
          youtubeKeys: process.env.YOUTUBE_API_KEYS
            ? process.env.YOUTUBE_API_KEYS.split(',').length
            : 0,
          cycleStartDate: process.env.CYCLE_START_DATE || '2025-10-27',
        },
        seeds: { perDay: 2000, totalCycle: 58000, sampleDay1Count: pickDailyList(1).length },
        uptime: `${Math.round(process.uptime())}s`,
        timestamp: new Date().toISOString(),
      };
      res.json(body);
    });

    app.use('/payments', paymentsRouter);

    // Simple Pi auth persistence endpoint (upsert user profile)
    app.post('/api/pi/auth', async (req, res) => {
      try {
        const { uid, username, wallet, language, country } = req.body || {};
        if (!username) {
          return res.status(400).json({ error: 'missing username' });
        }
        // Light validation
        const row = {
          pi_uid: uid || null,
          username,
          wallet: wallet || null,
          language: language || 'en',
          country: country || 'GLOBAL',
          user_consent: true,
        };
        const { error } = await supabase.from('users').upsert(row, { onConflict: 'pi_uid,username' });
        if (error) return res.status(500).json({ error: error.message });
        res.json({ ok: true });
      } catch (e) {
        res.status(500).json({ error: String(e?.message || e) });
      }
    });
    app.get('/', (req, res) => res.type('text/plain').send('Purple Music Backend (payments enabled).'));

    const PORT = process.env.PORT || 10000;
    const server = app.listen(PORT, () => {
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
    // 🛑 Graceful shutdown (simplified — no stopAllJobs)
    // ======================================================
    async function shutdown(signal) {
      console.log(`[shutdown] Received ${signal}. Closing server gracefully...`);

      await new Promise((resolve) => server.close(() => resolve()))
        .catch(() => {});
      clearInterval(heartbeat);

      await new Promise((r) => setTimeout(r, 500));
      console.log('[shutdown] ✅ Exiting now.');
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
