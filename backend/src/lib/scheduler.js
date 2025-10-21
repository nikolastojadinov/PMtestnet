import cron from 'node-cron';
import { runFetchPlaylists } from '../jobs/fetchPlaylists.js';
import { runRefreshPlaylists } from '../jobs/refreshPlaylists.js';
import { isDay31, pickAllPlaylistIds } from './monthlyCycle.js';
import { getSupabase } from './supabase.js';

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
  // 09:05 — normally fetch; if day31 => do full refresh
  cron.schedule('5 9 * * *', async () => {
    try {
      if (isDay31()) {
        console.log('[cron] day31 detected → FULL REFRESH at 09:05');
        const ids = await pickAllPlaylistIds(5000);
        // In this first pass, reuse the refresh job without passing ids; future enhancement can shard by ids
        await runRefreshPlaylists({ reason: 'day31-full' });
      } else {
        console.log('[cron] 09:05 daily fetch starting…');
        await runFetchPlaylists({ reason: 'daily-09:05' });
      }
    } catch (e) {
      console.error('[cron] 09:05 job error:', e.message);
    }
  });

  // 21:05 — daily refresh of yesterday's items
  cron.schedule('5 21 * * *', async () => {
    try {
      console.log('[cron] 21:05 daily refresh starting…');
      await runRefreshPlaylists({ reason: 'daily-21:05' });
    } catch (e) {
      console.error('[cron] 21:05 job error:', e.message);
    }
  });

  console.log('[scheduler] cron: fetch@09:05 (or full refresh on day31), refresh@21:05');
}
