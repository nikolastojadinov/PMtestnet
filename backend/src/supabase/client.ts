import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

function isValidUrl(u?: string | null) {
  if (!u) return false
  return /^https?:\/\//i.test(u)
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('Supabase env vars are missing. Some operations may fail.')
}

let sb: ReturnType<typeof createClient> | undefined
try {
  if (isValidUrl(SUPABASE_URL) && SUPABASE_SERVICE_KEY) {
    sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)
  }
} catch (e: any) {
  console.warn('Supabase client init skipped:', e?.message)
}

export const supabase = sb as any

export async function pingSupabase(): Promise<boolean> {
  try {
    if (!sb) {
      console.warn('Supabase client not configured; skipping ping.')
      return false
    }
    const { error } = await (sb.from('playlists').select('id', { count: 'exact', head: true }) as any)
    if (error) {
      console.warn('Supabase ping failed (playlists):', error.message)
      return false
    }
    console.log('Supabase client connected successfully.')
    return true
  } catch {
    console.warn('Supabase ping encountered an unexpected error.')
    return false
  }
}
