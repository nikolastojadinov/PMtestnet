// ✅ Backend entry — init only (no auto jobs on start)

import { initSupabase } from './lib/supabase.js';
import { startDualJobs } from './lib/scheduler.js';
import http from 'http';

async function main() {
  console.log('──────────────────────────────────────────────');
  console.log('[backend:init] Starting Purple Music backend...');
  console.log(`[backend:init] Node.js version: ${process.version}`);
  console.log('[backend:init] Environment:', process.env.NODE_ENV || 'development');

  const ok = await initSupabase();
  if (!ok) {
    console.error('[backend:init] Supabase ENV missing. Exiting.');
    process.exit(1);
  }
  console.log('[backend:init] ✅ Supabase initialized');

  // Samo startuj CRON — bez pokretanja poslova prilikom deploy-a
  startDualJobs();

  // Neki trivijalan HTTP server (Render health check)
  const port = process.env.PORT || 8080;
  http.createServer((_, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK\n');
  }).listen(port, () => {
    console.log(`[backend] listening on port :${port}`);
    console.log('──────────────────────────────────────────────');
  });
}

main().catch(err => {
  console.error('[backend:init] fatal error:', err);
  process.exit(1);
});
