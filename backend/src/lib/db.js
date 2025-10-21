// FULL REWRITE — jednostavni upsert helperi

import { getSupabase } from './supabase.js';

export async function upsertPlaylists(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { count: 0 };
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .upsert(rows, { onConflict: 'external_id' })
    .select('external_id');
  if (error) throw error;
  return { count: data?.length || 0 };
}
