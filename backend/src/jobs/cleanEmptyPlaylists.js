// ✅ FIXED VERSION — Marks empty playlists instead of deleting
// - Finds playlists without tracks
// - Sets item_count = 0 and sync_status = 'pending'
// - Keeps them for re-fetching later (do NOT delete)

import { getSupabase } from '../lib/supabase.js';

export async function runCleanEmptyPlaylists({ reason = 'auto-clean' } = {}) {
  const sb = getSupabase();
  console.log(`[cleanup] start (${reason}) — marking empty playlists as item_count=0`);

  try {
    // Pronadji sve playliste koje nemaju nijednu pesmu
    const { data: emptyPlaylists, error: findErr } = await sb
      .from('playlists')
      .select('id, title')
      .not('id', 'in', sb
        .from('playlist_tracks')
        .select('playlist_id'));

    if (findErr) throw findErr;

    if (!emptyPlaylists || emptyPlaylists.length === 0) {
      console.log('[cleanup] ✅ No empty playlists found.');
      return;
    }

    console.log(`[cleanup] Found ${emptyPlaylists.length} empty playlists → marking as item_count=0`);

    // Oznaci prazne plejliste umesto da ih brises
    const { error: updateErr } = await sb
      .from('playlists')
      .update({ item_count: 0, sync_status: 'pending' })
      .in('id', emptyPlaylists.map(p => p.id));

    if (updateErr) throw updateErr;

    console.log(`[cleanup] ✅ Updated ${emptyPlaylists.length} playlists (set item_count=0, sync_status=pending)`);
  } catch (e) {
    console.error('[cleanup] ❌ Error during playlist cleanup:', e.message);
  }
}
