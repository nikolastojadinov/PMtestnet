import { getSupabase } from './supabase.js';

export async function upsertPlaylists(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { count: 0 };
  const sb = getSupabase();
  const { data, error } = await sb.from('playlists').upsert(rows, { onConflict: 'external_id' }).select('external_id');
  if (error) throw error;
  return { count: data?.length || 0 };
}

export async function upsertTracks(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { count: 0 };
  const sb = getSupabase();
  const { data, error } = await sb.from('tracks').upsert(rows, { onConflict: 'external_id' }).select('external_id');
  if (error) throw error;
  return { count: data?.length || 0 };
}

export async function selectYesterdayPlaylists() {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('playlists_from_yesterday'); // optional RPC; create later if exists
  if (error) {
    // fallback: filter by fetched_on >= yesterday
    const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0,0,0,0);
    const { data: fallback, error: fbErr } = await sb
      .from('playlists')
      .select('*')
      .gte('fetched_on', y.toISOString());
    if (fbErr) throw fbErr;
    return fallback;
  }
  return data;
}
