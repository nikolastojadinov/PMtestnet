import { supabase } from '../supabase/client.js'
import { log } from '../utils/logger.js'

/**
 * Manual or automatic lock reset utility
 * --------------------------------------
 * This script clears any stale scheduler_state locks.
 * You can safely run it anytime from Render shell:
 *    node dist/cron/resetLock.js
 */

async function resetSchedulerLock() {
  try {
    const { data, error } = await (supabase
      .from('scheduler_state')
      .update({
        is_locked: false,
        updated_at: new Date().toISOString(),
      })
      .neq('is_locked', false)
      .select()
      .single() as any)

    if (error) {
      log('error', '[resetLock] Failed to reset scheduler lock', { error: error.message })
      process.exit(1)
    }

    if (data) {
      log('info', '[resetLock] Scheduler lock cleared ✅', data)
    } else {
      log('info', '[resetLock] No active lock found — nothing to clear.')
    }

    process.exit(0)
  } catch (e: any) {
    log('error', '[resetLock] Unexpected error', { error: e?.message })
    process.exit(1)
  }
}

resetSchedulerLock()
