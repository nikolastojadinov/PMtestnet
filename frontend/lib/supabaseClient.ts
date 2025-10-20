import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
	if (_client) return _client
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

	// During SSR/prerender or if envs are missing, return null and let callers guard
	if (!supabaseUrl || !supabaseAnonKey) {
		return null
	}

	_client = createClient(supabaseUrl, supabaseAnonKey)
	return _client
}
