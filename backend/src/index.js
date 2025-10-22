// ✅ FULL REWRITE — Express server + dual scheduler (playlists + tracks)

import 'dotenv/config';
import express from 'express';
import { initSupabase } from './lib/supabase.js';
import { startDualJobs } from './lib/scheduler.js';
import { runFetchPlaylists } from './jobs/fetchPlaylists.js';
import { runFetchTracks } from './jobs/fetchTracksFromPlaylist.js';

const app = express();
app.use(express.json());

// 🩺 Health check
app.get('/health', async (_req, res) => {
  try {
    const ok = await initSupabase(); // idempotentno
    res.json({ ok: true, db: ok, message: 'Backend is healthy and Supabase connected' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ▶️ Manual fetch playlists
app.post('/fetch', async (_req, res) => {
  try {
    await runFetchPlaylists({ reason: 'manual-endpoint' });
    res.json({ ok: true, message: 'Manual playlist fetch started' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 🎵 Manual fetch tracks (songs)
app.post('/fetch-tracks', async (_req, res) => {
  try {
    await runFetchTracks({ reason: 'manual-endpoint' });
    res.json({ ok: true, message: 'Manual track fetch started' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 8080;

// 🚀 Startup
(async () => {
  await initSupabase(); // pokreni Supabase konekciju
  startDualJobs();      // zakazuje 09:05 (playlists) + 14:00 (tracks)
  app.listen(PORT, () => {
    console.log(`[backend] listening on :${PORT}`);
  });
})();
