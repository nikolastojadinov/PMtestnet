// ✅ FIXED v3.2 — Marks empty playlists safely
import { getSupabase } from '../lib/supabase.js';

export async function runCleanEmptyPlaylists({ reason = 'manual-clean' } = {}) {
  const sb = getSupabase();
  console.log(`[cleanup] start (${reason}) — marking empty playlists as item_count=0`);

  // Pokupi sve playliste koje nemaju pesme
  const { data: emptyPls, error: err1 } = await sb
    .from('playlists')
    .select('id, title')
    .or('item_count.is.null,item_count.eq.0');

  if (err1) {
    console.error(`[cleanup] ❌ Fetch error:`, err1.message);
    return;
  }

  // Ako nema nijedne — izlaz
  if (!emptyPls || emptyPls.length === 0) {
    console.log('[cleanup] ✅ No empty playlists found.');
    return;
  }

  const ids = emptyPls.map(p => p.id).filter(Boolean);
  console.log(`[cleanup] Found ${ids.length} empty playlists → marking as pending.`);

  // Ažuriraj ih bez filter greške
  const { error: err2 } = await sb
    .from('playlists')
    .update({ item_count: 0, sync_status: 'pending' })
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']); // fallback kad je prazan niz

  if (err2) {
    console.error(`[cleanup] ❌ Update error:`, err2.message);
  } else {
    console.log(`[cleanup] ✅ ${ids.length} playlists marked as pending`);
  }
}
