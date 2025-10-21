import { createClient } from 'supabase';

let supabase = null;

export function getSupabase() {
  if (!supabase) throw new Error('Supabase not initialized yet.');
  return supabase;
}

export async function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
  supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { 'x-client-info': 'purple-music-backend' } }
  });
  console.log('[supabase] initialized');
}
