// backend/src/lib/metrics.js
// ✅ Minimal metrics helpers (best-effort; ignore errors)

import supabase from './supabase.js';

export async function logApiUsage(entry) {
  try {
    await supabase.from('api_usage').insert({
      api_key_hash: entry.api_key_hash || null,
      endpoint: entry.endpoint,
      quota_cost: entry.quota_cost ?? null,
      status: entry.status || 'ok',
      error_code: entry.error_code || null,
      error_message: entry.error_message || null,
    });
  } catch {}
}

export async function startFetchRun(payload = {}) {
  try {
    const { data, error } = await supabase
      .from('fetch_runs')
      .insert({
        mode: 'FETCH',
        day: payload.day ?? null,
        regions: payload.regions ?? null,
        categories: payload.categories ?? null,
      })
      .select('id')
      .single();
    if (error) return null;
    return data.id;
  } catch { return null; }
}

export async function finishFetchRun(id, updates = {}) {
  if (!id) return;
  try {
    await supabase
      .from('fetch_runs')
      .update({
        finished_at: new Date().toISOString(),
        keys_used: updates.keys_used ?? null,
        api_calls: updates.api_calls ?? null,
        items_discovered: updates.items_discovered ?? null,
        playlists_valid: updates.playlists_valid ?? null,
        playlists_invalid: updates.playlists_invalid ?? null,
        errors: updates.errors ?? [],
        notes: updates.notes ?? null,
      })
      .eq('id', id);
  } catch {}
}

export async function startRefreshRun(payload = {}) {
  try {
    const { data, error } = await supabase
      .from('refresh_runs')
      .insert({
        mode: 'REFRESH',
        day: payload.day ?? null,
      })
      .select('id')
      .single();
    if (error) return null;
    return data.id;
  } catch { return null; }
}

export async function finishRefreshRun(id, updates = {}) {
  if (!id) return;
  try {
    await supabase
      .from('refresh_runs')
      .update({
        finished_at: new Date().toISOString(),
        playlists_checked: updates.playlists_checked ?? null,
        playlists_changed: updates.playlists_changed ?? null,
        tracks_added: updates.tracks_added ?? null,
        tracks_removed: updates.tracks_removed ?? null,
        api_calls: updates.api_calls ?? null,
        errors: updates.errors ?? [],
        notes: updates.notes ?? null,
      })
      .eq('id', id);
  } catch {}
}
