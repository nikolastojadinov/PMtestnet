// Warm-up task (slot-isolated version)
// Stores per-slot key track_targets_<slotLabel> to prevent race conflicts

import { supabase } from '../supabase.js';

function isoNow() { return new Date().toISOString(); }

export async function prepareWarmupTargets(limit = 1000, slotLabel = '0000') {
  const key = `track_targets_${slotLabel}`;
  let payload = { created_at: isoNow(), count: 0, playlists: [], slot: slotLabel };

  // Try RPC first for efficient selection
  try {
    const { data, error } = await supabase.rpc('prepare_warmup_targets', { p_limit: limit });
    if (!error && Array.isArray(data) && data.length) {
      payload = { created_at: isoNow(), count: data.length, playlists: data, slot: slotLabel };
      await supabase.from('job_state').upsert({ key, value: payload }, { onConflict: 'key' });
      return payload;
    }
  } catch {}

  // Fallback: random client-side selection
  const oversample = Math.min(limit * 3, 10000);
  const { data: pool, error } = await supabase
    .from('playlists')
    .select('id,external_id')
    .eq('is_public', true)
    .gt('item_count', 0)
    .order('last_refreshed_on', { ascending: true, nullsFirst: true })
    .limit(oversample);

  if (error || !pool?.length) {
    await supabase.from('job_state').upsert({ key, value: payload }, { onConflict: 'key' });
    return payload;
  }

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

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

  payload = { created_at: isoNow(), count: candidates.length, playlists: candidates, slot: slotLabel };
  await supabase.from('job_state').upsert({ key, value: payload }, { onConflict: 'key' });
  return payload;
}

export default { prepareWarmupTargets };
