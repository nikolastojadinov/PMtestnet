// ✅ FULL REWRITE v2.0 — Auto-cleaner for empty playlists
// - Runs before each track-fetch batch (e.g. at 12:55, 13:55, 14:55...)
// - Detects playlists with no linked tracks
// - Sets item_count = 0 and deletes them safely from Supabase

import { getSupabase } from '../lib/supabase.js';

export async function runCleanEmptyPlaylists({ reason = 'scheduled-cleanup' } = {}) {
  const sb = getSupabase();
  console.log(`[cleanup] start (${reason})`);

  try {
    // ✅ Mark all playlists that have no linked tracks
    const { error: updateErr } = await sb.rpc('exec', {
      sql: `
        UPDATE playlists
        SET item_count = 0
        WHERE id NOT IN (
          SELECT DISTINCT playlist_id FROM playlist_tracks
        );
      `
    });
    if (updateErr) throw updateErr;

    // ✅ Delete all playlists that have 0 items
    const { error: deleteErr } = await sb
      .from('playlists')
      .delete()
      .eq('item_count', 0);

    if (deleteErr) throw deleteErr;

    console.log('[cleanup] ✅ Empty playlists cleaned up successfully');
  } catch (e) {
    console.error('[cleanup] ❌ Error during cleanup:', e.message);
  }
}
