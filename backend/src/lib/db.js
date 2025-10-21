import { getSupabase } from './supabase.js';

function shapePlaylists(rows) {
  const rich = process.env.SUPABASE_RICH_SCHEMA === '1';
  if (rich) return rows;
  // Safe default: only IDs to avoid unknown-column errors
  return rows.map(r => ({ external_id: r.external_id }));
}

function shapeTracks(rows) {
  const rich = process.env.SUPABASE_RICH_SCHEMA === '1';
  if (rich) return rows;
  return rows.map(r => ({ external_id: r.external_id }));
}

export async function upsertPlaylists(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { count: 0 };
  const sb = getSupabase();
  const payload = shapePlaylists(rows);
  const { data, error } = await sb.from('playlists').upsert(payload, { onConflict: 'external_id' }).select('external_id');
  if (error) {
    // Fallback when no unique constraint exists on external_id
    if (error.code === '42P10' || /no unique|ON CONFLICT/i.test(error.message || '')) {
      const { data: ins, error: insErr } = await sb.from('playlists').insert(payload).select('external_id');
      if (insErr) throw insErr;
      return { count: ins?.length || 0 };
    }
    throw error;
  }
  return { count: data?.length || 0 };
}

export async function upsertTracks(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return { count: 0 };
  const sb = getSupabase();
  const payload = shapeTracks(rows);
  const { data, error } = await sb.from('tracks').upsert(payload, { onConflict: 'external_id' }).select('external_id');
  if (error) {
    if (error.code === '42P10' || /no unique|ON CONFLICT/i.test(error.message || '')) {
      const { data: ins, error: insErr } = await sb.from('tracks').insert(payload).select('external_id');
      if (insErr) throw insErr;
      return { count: ins?.length || 0 };
    }
    throw error;
  }
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
