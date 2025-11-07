// Warm-up task: prepare a set of target playlists (tracks=0) for the next fetch slot
// Stores in job_state key 'track_targets_next' with structure { created_at, count, playlists: [{id, external_id}] }

import { supabase } from '../supabase.js';

function isoNow() { return new Date().toISOString(); }

export async function prepareWarmupTargets(limit = 1000) {
  // Try RPC first for efficient server-side selection
  try {
    const { data, error } = await supabase.rpc('prepare_warmup_targets', { p_limit: limit });
    if (!error && Array.isArray(data) && data.length) {
      const payload = { created_at: isoNow(), count: data.length, playlists: data };
      await supabase.from('job_state').upsert({ key: 'track_targets_next', value: payload }, { onConflict: 'key' });
      return payload;
    }
  } catch {}

  // Fallback: random client-side sampling then exclude those already having tracks
  const oversample = Math.min(limit * 3, 10000);
  const { data: pool, error } = await supabase
    .from('playlists')
    .select('id,external_id')
    .eq('is_public', true)
    .gt('item_count', 0)
    .order('last_refreshed_on', { ascending: true, nullsFirst: true })
    .limit(oversample);
  if (error || !pool?.length) {
    const payload = { created_at: isoNow(), count: 0, playlists: [] };
    await supabase.from('job_state').upsert({ key: 'track_targets_next', value: payload }, { onConflict: 'key' });
    return payload;
  }
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // Exclude playlists already having tracks
  const ids = pool.map(p => p.id);
  const existing = new Set();
  const BATCH = 500;
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const { data, error: e2 } = await supabase
      .from('playlist_tracks')
      .select('playlist_id')
      .in('playlist_id', chunk)
      .limit(1);
    if (!e2 && data) for (const r of data) existing.add(r.playlist_id);
  }
  const candidates = [];
  for (const p of pool) {
    if (!existing.has(p.id)) candidates.push(p);
    if (candidates.length >= limit) break;
  }
  const payload = { created_at: isoNow(), count: candidates.length, playlists: candidates };
  await supabase.from('job_state').upsert({ key: 'track_targets_next', value: payload }, { onConflict: 'key' });
  return payload;
}

export default { prepareWarmupTargets };
