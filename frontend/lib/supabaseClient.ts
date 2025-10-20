import { createClient } from '@supabase/supabase-js'

let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[Supabase] Missing environment variables. Check Netlify settings.')
    return null
  }

  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: true,
      },
      global: {
        headers: {
          'x-frontend-origin': process.env.NEXT_PUBLIC_FRONTEND_URL || '',
        },
      },
    })

    console.log('[Supabase] Client initialized.')
    return supabaseClient
  } catch (error) {
    console.error('[Supabase] Failed to initialize client:', error)
    return null
  }
}
