import dotenv from 'dotenv'
import { supabase } from '../supabase/client.js'

dotenv.config()

async function reset() {
  if (!supabase) {
    console.warn('[resetLock] Supabase not configured.')
    return
  }
  const now = new Date().toISOString()
  const { error } = await (supabase
    .from('scheduler_state')
    .update({ is_locked: false, updated_at: now }) as any)
  if (error) {
    console.error('[resetLock] Failed to reset lock:', error.message)
    process.exitCode = 1
    return
  }
  console.log('[resetLock] Lock cleared (is_locked=false).')
}

reset().catch((e) => {
  console.error('[resetLock] Fatal:', e?.message || e)
  process.exit(1)
})
