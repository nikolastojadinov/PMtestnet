// FULL REWRITE — Express server + scheduler wiring + endpoints

import 'dotenv/config';
import express from 'express';
import { initSupabase } from './lib/supabase.js'; // već postoji kod tebe; ne menjamo ga
import { startDailyJob, runFetchNow, runRefreshNow, getPhaseInfo } from './lib/scheduler.js';

const app = express();
app.use(express.json());

// Health
app.get('/health', async (_req, res) => {
  try {
    const ok = await initSupabase(); // idempotentno
    const phase = getPhaseInfo();
    res.json({ ok: true, db: ok, phase });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Manual fetch (guard: samo kad je faza fetch)
app.post('/fetch', async (_req, res) => {
  const { phase } = getPhaseInfo();
  if (phase !== 'fetch') return res.status(409).json({ ok: false, error: 'Not in FETCH phase' });
  try {
    await runFetchNow('manual-endpoint');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Manual refresh (radi uvek — korisno za test)
app.post('/refresh', async (_req, res) => {
  try {
    const info = getPhaseInfo();
    await runRefreshNow('manual-endpoint', info.targetDay);
    res.json({ ok: true, ...info });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 8080;

(async () => {
  await initSupabase();       // pokreni Supabase (bez ovoga jobovi nemaju DB)
  startDailyJob();            // zakazuje jedini dnevni job u 09:05
  app.listen(PORT, () => {
    console.log(`[backend] listening on :${PORT}`);
  });
})();
