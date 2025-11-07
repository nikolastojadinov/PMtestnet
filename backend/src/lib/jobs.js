// backend/src/lib/jobs.js
// Bridge module exposing standardized job entrypoints for scheduler.

import { runSeedDiscovery } from './youtube.js';
import { supabase } from './supabase.js';

export async function runPurgeTracks() {
  try {
    // counts BEFORE
    const { data: c1 } = await supabase.rpc('get_counts_snapshot').catch(() => ({ data: null }));
    const before = c1 || {};
    console.log(`[purge-tracks] starting… (counts: playlists=${before.playlists ?? '?'} , tracks=${before.tracks ?? '?'} , links=${before.links ?? '?'})`);
    const sql = `BEGIN; DELETE FROM public.playlist_tracks; DELETE FROM public.tracks; COMMIT;`;
    const candidates = [['exec_sql', { sql }], ['execute_sql', { sql }], ['run_sql', { sql }]];
    let executed = false;
    for (const [fn, payload] of candidates) {
      try { const { error } = await supabase.rpc(fn, payload); if (!error) { executed = true; break; } } catch {}
    }
    if (!executed) {
      // fallback: best-effort deletes without transaction (RPC not available)
      await supabase.from('playlist_tracks').delete().gt('track_id', -1);
      await supabase.from('tracks').delete().gt('id', -1);
    }
    const { data: c2 } = await supabase.rpc('get_counts_snapshot').catch(() => ({ data: null }));
    const after = c2 || {};
    console.log(`[purge-tracks] finished. deleted tracks=${before.tracks ?? '?'} , links=${before.links ?? '?'} → now tracks=${after.tracks ?? '?'} , links=${after.links ?? '?'} `);
  } catch (e) {
    console.warn('[purge-tracks] ⚠️ error:', e?.message || String(e));
  }
}

// Warm-up placeholder (extend with real checks later)
export async function runWarmupCycle(day, slot) {
  console.log(`[jobs] warmup cycle day=${day} slot=${slot}`);
  return true;
}

// Track fetch placeholder (extend with real track sync logic)
export async function runTrackFetchCycle(day, slot) {
  console.log(`[jobs] track fetch cycle day=${day} slot=${slot}`);
  return true;
}

export { runSeedDiscovery };
