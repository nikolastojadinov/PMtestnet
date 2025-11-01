// ✅ FULL REWRITE v3.3 — Marks empty playlists as NEW (ready for track fetch)
// - Finds all playlists without any tracks
// - Marks them as item_count=0 and sync_status='new'
// - Safe for empty result sets, no deletions

import { getSupabase } from '../lib/supabase.js';

export async function runCleanEmptyPlaylists({ reason = 'manual-clean' } = {}) {
  const sb = getSupabase();
  console.log(`[cleanup] start (${reason}) — marking empty playlists as new`);

  // 🔹 Pokupi sve playliste koje su prazne ili bez item_count vrednosti
  const { data: emptyPls, error: err1 } = await sb
    .from('playlists')
    .select('id, title')
    .or('item_count.is.null,item_count.eq.0');

  if (err1) {
    console.error(`[cleanup] ❌ Fetch error:`, err1.message);
    return;
  }

  // 🔹 Ako nema nijedne prazne playliste
  if (!emptyPls || emptyPls.length === 0) {
    console.log('[cleanup] ✅ No empty playlists found.');
    return;
  }

  const ids = emptyPls.map(p => p.id).filter(Boolean);
  console.log(`[cleanup] Found ${ids.length} empty playlists → marking as new.`);

  // 🔹 Ažuriraj ih sigurno (fallback ako je niz prazan)
  const { error: err2 } = await sb
    .from('playlists')
    .update({ item_count: 0, sync_status: 'new' })
    .in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);

  if (err2) {
    console.error(`[cleanup] ❌ Update error:`, err2.message);
  } else {
    console.log(`[cleanup] ✅ ${ids.length} playlists marked as new`);
  }
}
