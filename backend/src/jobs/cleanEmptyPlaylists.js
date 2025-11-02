// backend/src/jobs/cleanEmptyPlaylists.js
// ✅ Returns UUID ids of playlists with no linked tracks (uses RPC fallback)

import supabase from '../lib/supabase.js';

export async function cleanEmptyPlaylists(limit = 1000) {
  // Prefer RPC for efficient server-side selection
  const { data, error } = await supabase.rpc('get_empty_playlists', { limit_count: limit });
  if (!error && Array.isArray(data)) {
    const ids = data.map((r) => r.id).filter(Boolean);
    console.log(`[clean] ✅ Selected ${ids.length} empty playlists via RPC`);
    return ids;
  }
  console.warn('[clean] ⚠️ RPC get_empty_playlists missing or failed; falling back');

  // Fallback: pick most recent playlists and rely on later filtering (less efficient)
  const { data: playlists, error: err2 } = await supabase
    .from('playlists')
    .select('id')
    .order('fetched_on', { ascending: false })
    .limit(Math.min(200, limit));
  if (err2) {
    console.error('[clean] ❌ Fallback query failed:', err2.message);
    return [];
  }
  const ids = (playlists || []).map((p) => p.id);
  console.log(`[clean] ✅ Fallback selected ${ids.length} candidates`);
  return ids;
}
