// ✅ FULL REWRITE — Express server + Dual Scheduler (Playlists + Tracks)
// 50%–50% daily quota balance system

import 'dotenv/config';
import express from 'express';
import { initSupabase } from './lib/supabase.js';
import { startDualJobs } from './lib/scheduler.js';
import { runFetchPlaylists } from './jobs/fetchPlaylists.js';
import { runFetchTracks } from './jobs/fetchTracksFromPlaylist.js';

const app = express();
app.use(express.json());

// 🩺 Health check endpoint
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

// ▶️ Manual trigger for playlist fetch
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

// 🎵 Manual trigger for track fetch
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

  // Pokreni automatske cron poslove
  startDualJobs();

  app.listen(PORT, () => {
    console.log(`[backend] listening on port :${PORT}`);
    console.log('──────────────────────────────────────────────');
  });
})();
