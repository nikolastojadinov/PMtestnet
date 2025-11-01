import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ofkfygqrfenctzitigae.supabase.co'
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '<insert your anon key>'

// Singleton pattern to prevent multiple instances in browser
let _supabase: ReturnType<typeof createClient> | null = null

if (!_supabase) {
  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false, // disable local session storage to avoid "user_id conflict"
      detectSessionInUrl: false,
    },
  })
  console.log('✅ Supabase connected successfully (single instance).')
}
const supabase = _supabase as ReturnType<typeof createClient>

export { supabase }
export default supabase
