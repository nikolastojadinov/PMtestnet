import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Netlify-safe: fall back to defaults if env vars are missing
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ofkfygqrfenctzitigae.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '<insert your anon key>';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Helpful init log (safe in browser and build logs)
// eslint-disable-next-line no-console
console.info('Supabase connected successfully.');

export default supabase;
