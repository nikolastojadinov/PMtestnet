import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runRefreshPlaylists } from '../jobs/refreshPlaylists.js';

export async function bootstrapAfterDeploy() {
  if (process.env.BOOTSTRAP_FETCH === 'true') {
    console.log('[scheduler] BOOTSTRAP_FETCH=true → running immediate fetch');
    try {
      await runFetchPlaylists({ reason: 'bootstrap' });
    } catch (e) {
      console.error('[scheduler] bootstrap fetch failed:', e.message);
    }
  }
}

export async function startCronJobs() {
  // Fetch: every day at 09:05 local time
  cron.schedule('5 9 * * *', async () => {
    console.log('[cron] 09:05 daily fetch starting…');
    await runFetchPlaylists({ reason: 'daily-09:05' });
  });

  // Refresh: every day at 21:05 local time
  cron.schedule('5 21 * * *', async () => {
    console.log('[cron] 21:05 daily refresh starting…');
    await runRefreshPlaylists({ reason: 'daily-21:05' });
  });

  console.log('[scheduler] cron jobs scheduled: fetch@09:05, refresh@21:05');
}
