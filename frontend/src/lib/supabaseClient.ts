import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Read env vars once and determine if configuration is valid (no placeholders/empties)
const RAW_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const RAW_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  RAW_URL && RAW_ANON && !RAW_ANON.includes('<insert')
);

// Create a client. If not configured, point to a harmless invalid host to avoid accidental calls.
const supabaseUrl = isSupabaseConfigured ? RAW_URL : 'https://invalid.localhost';
const supabaseAnonKey = isSupabaseConfigured ? RAW_ANON : 'invalid-anon-key';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Helpful init log (safe in browser and build logs)
// eslint-disable-next-line no-console
if (isSupabaseConfigured) {
  console.info('Supabase connected successfully.');
} else {
  console.warn(
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY and redeploy.'
  );
}

export default supabase;
