import { createClient } from '@supabase/supabase-js'

let cached: any | null = null

export function getSupabase() {
  if (cached) return cached
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    // Soft warn to avoid build-time failures; return null-like value
    // eslint-disable-next-line no-console
    console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are not set')
    return null as any
  }
  cached = createClient(url, anon)
  return cached
}

export default getSupabase
