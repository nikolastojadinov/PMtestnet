// ✅ FULL REWRITE v3.7 — Purple Music backend entrypoint

import express from 'express';
import cron from 'node-cron';
import supabase from './lib/supabase.js';
import { runFetchTracks } from './jobs/fetchTracksFromPlaylist.js';
import { runFetchPlaylists } from './jobs/fetchPlaylists.js';
import { runCleanEmptyPlaylists } from './jobs/cleanEmptyPlaylists.js';

const app = express();
const PORT = process.env.PORT || 8080;

console.log('──────────────────────────────────────────────');
console.log('[backend:init] Starting Purple Music backend...');
console.log(`[backend:init] Node.js version: ${process.version}`);
console.log(`[backend:init] Environment: ${process.env.NODE_ENV || 'development'}`);

// ✅ Supabase client check
if (!supabase) {
  console.error('[supabase] ❌ Supabase client not initialized!');
  process.exit(1);
}
console.log('[supabase] client initialized');

// ✅ SCHEDULER SETUP
console.log('[scheduler] ✅ cron set:');
console.log('  - cleanup@12:55→21:55');
console.log('  - tracks@13:00→22:00 (Europe/Belgrade)');

// Cleanup job
cron.schedule('55 12,21 * * *', async () => {
  console.log('[scheduler] 🧹 Running cleanup job...');
  await runCleanEmptyPlaylists();
});

// Playlist + Track fetch job
cron.schedule('0 13,22 * * *', async () => {
  console.log('[scheduler] 🎵 Running fetch job...');
  await runFetchPlaylists();
  await runFetchTracks();
});

// HTTP server
app.get('/', (req, res) => {
  res.json({ status: 'Purple Music backend running ✅' });
});

app.listen(PORT, () => {
  console.log(`[backend] listening on port :${PORT}`);
  console.log('──────────────────────────────────────────────');
});
