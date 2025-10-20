import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

try {
  if (url && anon) {
    cached = createClient(url, anon)
  } else {
    // eslint-disable-next-line no-console
    console.warn('[supabase] NEXT_PUBLIC_SUPABASE_URL/ANON_KEY are not set')
  }
} catch (e: any) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] Failed to init client:', e?.message)
}

export function getSupabase(): SupabaseClient | null {
  return cached
}

export const supabase = cached

export default getSupabase
