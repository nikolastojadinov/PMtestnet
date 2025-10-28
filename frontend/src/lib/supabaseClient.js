import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	// Help diagnose 401s in production when env vars are missing/misnamed
	// eslint-disable-next-line no-console
	console.warn('[supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Public data will not load.');
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
