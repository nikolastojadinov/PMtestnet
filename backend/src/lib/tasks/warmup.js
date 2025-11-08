// backend/src/lib/tasks/warmup.js
// ⏱ Warm-up every 30 min starting at 12:55 Europe/Budapest (20 runs total)

import cron from 'node-cron';
import { supabase } from '../supabase.js';

function isoNow() { return new Date().toISOString(); }

export async function prepareWarmupTargets(limit = 1000, slotLabel = '0000') {
  const key = `track_targets_${slotLabel}`;
  let payload = { created_at: isoNow(), count: 0, playlists: [], slot: slotLabel };

  try {
    const { data, error } = await supabase.rpc('prepare_warmup_targets', { p_limit: limit });
    if (!error && Array.isArray(data) && data.length) {
      payload = { created_at: isoNow(), count: data.length, playlists: data, slot: slotLabel };
      await supabase.from('job_state').upsert({ key, value: payload }, { onConflict: 'key' });
      console.log(`[warmup:${slotLabel}] ✅ prepared ${data.length} playlists`);
      return payload;
    }
  } catch (e) {
    console.warn(`[warmup:${slotLabel}] ⚠️ RPC failed, using fallback:`, e?.message || e);
  }

  // fallback
  const oversample = Math.min(limit * 3, 10000);
  const { data: pool } = await supabase
    .from('playlists')
    .select('id,external_id')
    .eq('is_public', true)
    .gt('item_count', 0)
    .order('last_refreshed_on', { ascending: true, nullsFirst: true })
    .limit(oversample);

  const candidates = (pool || []).slice(0, limit);
  payload = { created_at: isoNow(), count: candidates.length, playlists: candidates, slot: slotLabel };
  await supabase.from('job_state').upsert({ key, value: payload }, { onConflict: 'key' });
  console.log(`[warmup:${slotLabel}] ✅ fallback prepared ${candidates.length}`);
  return payload;
}

// 🔁 Warm-up schedule: 12:55, 13:25, 13:55, 14:25, ... (20 runs total)
const warmupSlots = [];
let hour = 12, minute = 55;
for (let i = 0; i < 20; i++) {
  warmupSlots.push(`${minute} ${hour} * * *`);
  minute += 30;
  if (minute >= 60) { minute -= 60; hour = (hour + 1) % 24; }
}

export function startWarmupSchedule() {
  const TZ = process.env.TZ || 'Europe/Budapest';
  warmupSlots.forEach((pattern, i) => {
    const label = `${String(i + 1).padStart(2, '0')}`;
    cron.schedule(pattern, async () => {
      console.log(`[scheduler] 🎯 Warm-up slot ${label} triggered (${pattern} ${TZ})`);
      await prepareWarmupTargets(1000, label);
    }, { timezone: TZ });
  });
  console.log(`[warmup] ✅ 20 warm-up jobs scheduled from 12:55 every 30 min (${TZ})`);
}
