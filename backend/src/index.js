// ✅ FULL REWRITE — Express server + Dual Scheduler (Playlists + Tracks)
// 50%–50% daily quota balance system + Render live endpoint + Auto-recovery system

import 'dotenv/config';
import express from 'express';
import { initSupabase } from './lib/supabase.js';
import { startDualJobs } from './lib/scheduler.js';
import { runFetchPlaylists } from './jobs/fetchPlaylists.js';
import { runFetchTracks } from './jobs/fetchTracksFromPlaylist.js';

const app = express();
app.use(express.json());

/* 🩺 Health check endpoint
   Vraća status Supabase konekcije i broj učitanih YouTube API ključeva */
app.get('/health', async (_req, res) => {
  try {
    const ok = await initSupabase();
    const keys = (process.env.YOUTUBE_API_KEYS || '').split(',').filter(Boolean).length;
    res.json({
      ok: true,
      db: ok,
      api_keys_loaded: keys,
      message: 'Backend operational and connected to Supabase',
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* 🌐 Root endpoint (Render proof-of-life)
   Render koristi ovu rutu za proveru da li je backend “živ” */
app.get('/', (_req, res) => {
  res.send('Purple Music backend is running 🎵');
});

/* ▶️ Manual trigger za playlist fetch */
app.post('/fetch', async (_req, res) => {
  try {
    console.log('[manual] Triggered playlist fetch...');
    await runFetchPlaylists({ reason: 'manual-endpoint' });
    res.json({ ok: true, message: 'Manual playlist fetch completed ✅' });
  } catch (e) {
    console.error('[manual] playlist fetch error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* 🎵 Manual trigger za track fetch */
app.post('/fetch-tracks', async (_req, res) => {
  try {
    console.log('[manual] Triggered track fetch...');
    await runFetchTracks({ reason: 'manual-endpoint' });
    res.json({ ok: true, message: 'Manual track fetch completed ✅' });
  } catch (e) {
    console.error('[manual] track fetch error:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 8080;

/* 🚀 Glavni pokretač backend-a */
(async () => {
  console.log('──────────────────────────────────────────────');
  console.log('[backend:init] Starting Purple Music backend...');
  console.log(`[backend:init] Node.js version: ${process.version}`);
  console.log(`[backend:init] Environment: ${process.env.NODE_ENV || 'production'}`);

  try {
    await initSupabase();
    console.log('[backend:init] ✅ Supabase initialized');
  } catch (e) {
    console.error('[backend:init] ❌ Failed to init Supabase:', e.message);
  }

  // 🕐 Pokreni automatske cron poslove (09:05 i 14:00)
  startDualJobs();

  // 🧠 Auto-recovery sistem — ako je backend redeployovan posle 13:00, pokreni tracks odmah
  setTimeout(async () => {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    if (hour >= 13 && hour < 14) {
      console.log(`[auto-recovery] Detected restart after ${hour}:${minutes} → running track fetch early...`);
      try {
        await runFetchTracks({ reason: 'auto-recovery-after-deploy' });
        console.log('[auto-recovery] ✅ Track fetch completed automatically.');
      } catch (e) {
        console.error('[auto-recovery] ❌ Track fetch failed:', e.message);
      }
    }
  }, 20000); // 20 sekundi posle starta

  app.listen(PORT, () => {
    console.log(`[backend] listening on port :${PORT}`);
    console.log('──────────────────────────────────────────────');
  });
})();
