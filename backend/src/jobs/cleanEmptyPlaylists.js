// ✅ FULL REWRITE v3.4 — Safe batched updates for marking empty playlists as 'new'
// - Finds all empty playlists (no tracks or item_count=0)
// - Updates in batches of 200 to avoid Supabase 'Bad Request' errors

import { getSupabase } from '../lib/supabase.js';

export async function runCleanEmptyPlaylists({ reason = 'manual-clean' } = {}) {
  const sb = getSupabase();
  console.log(`[cleanup] start (${reason}) — marking empty playlists as new`);

  const { data: emptyPls, error: err1 } = await sb
    .from('playlists')
    .select('id, title')
    .or('item_count.is.null,item_count.eq.0');

  if (err1) {
    console.error(`[cleanup] ❌ Fetch error:`, err1.message);
    return;
  }

  if (!emptyPls || emptyPls.length === 0) {
    console.log('[cleanup] ✅ No empty playlists found.');
    return;
  }

  const ids = emptyPls.map(p => p.id).filter(Boolean);
  console.log(`[cleanup] Found ${ids.length} empty playlists → marking as new.`);

  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error: err2 } = await sb
      .from('playlists')
      .update({ item_count: 0, sync_status: 'new' })
      .in('id', batch);

    if (err2) {
      console.error(`[cleanup] ❌ Batch ${i / batchSize + 1} error:`, err2.message);
    } else {
      console.log(`[cleanup] ✅ Batch ${i / batchSize + 1} updated (${batch.length} playlists)`);
    }
  }

  console.log(`[cleanup] ✅ All empty playlists processed (${ids.length} total).`);
}
