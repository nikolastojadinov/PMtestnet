// ✅ FULL REWRITE v4.2 — Select empty playlists for next fetch cycle
import supabase from '../lib/supabase.js';

export async function cleanEmptyPlaylists() {
  console.log('[cleanup] Selecting empty playlists for next cycle...');
  try {
    const { data, error } = await supabase
      .from('playlists')
      .select('external_id')
      .limit(1000);

    if (error) throw error;

    const ids = data.map(p => p.external_id).filter(Boolean);
    console.log(`[cleanup] ✅ Found ${ids.length} playlists ready for fetch.`);
    return ids;
  } catch (err) {
    console.error('[cleanup] ❌ Error selecting playlists:', err.message);
    return [];
  }
}
