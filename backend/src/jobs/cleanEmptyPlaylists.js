// backend/src/jobs/cleanEmptyPlaylists.js
// ✅ Ne briše! Samo vraća listu praznih playlist external_id (cilj za naredni sat)

import supabase from '../lib/supabase.js';

export async function cleanEmptyPlaylists(limit = 200) {
  // Prazna = nema ni jedan track vezan (po našem kriterijumu: track.source='youtube' AND track.playlist_external_id=playlists.external_id)
  // Ako nemaš kolonu playlist_external_id u tracks, koristimo pomocnu logiku: prioritetno nove/fresh playliste (fetched_on DESC)
  const { data, error } = await supabase
    .from('playlists')
    .select('external_id')
    .order('fetched_on', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[clean] ❌ Query failed:', error.message);
    return [];
  }
  const ids = (data || []).map(r => r.external_id).filter(Boolean);
  console.log(`[clean] ✅ Selected ${ids.length} playlists as targets (no delete).`);
  return ids;
}
