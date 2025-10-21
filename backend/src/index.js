import 'dotenv/config';
import express from 'express';
import { initSupabase } from './lib/supabase.js';
import { startCronJobs, bootstrapAfterDeploy } from './lib/scheduler.js';
import { router as healthRouter } from './routes/health.js';

const app = express();
app.use(express.json());
app.use('/health', healthRouter);

const PORT = process.env.PORT || 8080;

(async () => {
  await initSupabase();
  await bootstrapAfterDeploy(); // run immediate fetch on first deploy if BOOTSTRAP_FETCH=true
  await startCronJobs();        // schedule daily jobs in Europe/Budapest TZ
  app.listen(PORT, () => {
    console.log(`[backend] listening on :${PORT} (TZ=${process.env.TZ || 'system'})`);
  });
})().catch((err) => {
  console.error('[backend] fatal startup error:', err);
  process.exit(1);
});
