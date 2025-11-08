// Warm-up task (auto 30-min cadence)
// Triggered every 30 minutes — 25 and 55 (Europe/Budapest)
// Stores per-slot key track_targets_<slotLabel> to prevent race conflicts

import cron from 'node-cron';
import { supabase } from '../supabase.js';

const TZ = process.env.TZ || 'Europe/Budapest';
process.env.TZ = TZ;

function isoNow() { return new Date().toISOString(); }

export async function prepareWarmupTargets(limit = 1000, slotLabel = null) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const label = slotLabel || `${hh}${mm}`;
  const key = `track_targets_${label}`;
  let payload = { created_at: isoNow(), count: 0, playlists: [], slot: label };

  try {
    const { data, error } = await supabase.rpc('prepare_warmup_targets', { p_limit: limit });
    if (!error && Array.isArray(data) && data.length) {
      payload = { created_at: isoNow(), count: data.length, playlists: data, slot: label };
      await supabase.from('job_state').upsert({ key, value: payload }, { onConflict: 'key' });
      console.log(`[warmup:${label}] ✅ prepared ${data.length} playlists via RPC`);
      return payload;
    }
  } catch {}

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
    console.log(`[warmup:${label}] ⚠️ no playlists found`);
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

  payload = { created_at: isoNow(), count: candidates.length, playlists: candidates, slot: label };
  await supabase.from('job_state').upsert({ key, value: payload }, { onConflict: 'key' });
  console.log(`[warmup:${label}] ✅ selected ${candidates.length} playlists`);
  return payload;
}

// ⏰ Auto scheduler — runs every 30 minutes (5 min before fetchTracks)
cron.schedule('25,55 * * * *', async () => {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const label = `${hh}${mm}`;
  console.log(`[cron] 🔁 Running warmup for slot ${label} (${TZ})`);
  await prepareWarmupTargets(1000, label);
}, { timezone: TZ });

export default { prepareWarmupTargets };
