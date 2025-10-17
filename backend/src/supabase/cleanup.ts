import dotenv from 'dotenv'
import { supabase } from './client.js'

dotenv.config()

async function tryDelete(table: string) {
  try {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.from(table).delete().neq('id', '')
    if (error) {
      // Table might not exist or lacks 'id' column; attempt unconditional delete
      const alt = await supabase.from(table).delete().not('created_at', 'is', null)
      if (alt.error) {
        console.warn(`[cleanup] Skipping table '${table}': ${alt.error.message}`)
        return
      }
    }
    console.log(`[cleanup] Cleared table '${table}'`)
  } catch (e: any) {
    console.warn(`[cleanup] Could not clear table '${table}': ${e?.message || e}`)
  }
}

async function main() {
  const targets = ['users', 'likes', 'statistics']
  for (const t of targets) {
    await tryDelete(t)
  }
  console.log('[cleanup] Done')
}

main().catch((e) => {
  console.error('[cleanup] Fatal', e)
  process.exit(1)
})
