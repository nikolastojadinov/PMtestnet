import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function ensureClient(): SupabaseClient {
	if (_client) return _client;
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !anonKey) {
		throw new Error(
			'Supabase environment variables are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
		);
	}
	_client = createClient(url, anonKey);
	return _client;
}

// Lazy proxy so importing this module during Next build doesn't instantiate the client
export const supabase = new Proxy({} as unknown as SupabaseClient, {
	get(_target, prop, receiver) {
		const client = ensureClient();
		// @ts-expect-error - indexer access
		const value = client[prop];
		return typeof value === 'function' ? value.bind(client) : value;
	},
}) as SupabaseClient;

// Also export a getter for explicit access if preferred
export function getSupabaseClient(): SupabaseClient {
	return ensureClient();
}
