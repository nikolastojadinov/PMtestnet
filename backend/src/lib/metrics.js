// backend/src/lib/metrics.js
// ✅ Definitive API usage metrics logger
// - Logs all API calls to Supabase (api_usage)
// - Safe SHA-256 hashing of API keys
// - Non-blocking for fetch flows (errors are caught and only logged)
// - Compatible with logQuotaError() calls from playlist discovery

import crypto from 'crypto';
import supabase from './supabase.js';

export function hashKey(key) {
  if (!key) return null;
  try {
    return crypto.createHash('sha256').update(String(key)).digest('hex');
  } catch {
    return null;
  }
}

export async function logApiUsage(info = {}) {
  try {
    const payload = {
      ts: new Date().toISOString(),
      api_key_hash: hashKey(info.apiKey),
      endpoint: info.endpoint || 'unknown',
      quota_cost: info.quotaCost ?? null,
      status: info.status || 'ok',
      error_code: info.errorCode || null,
      error_message: info.errorMessage || null,
    };

    const { error } = await supabase.from('api_usage').insert(payload);
    if (error) console.warn('[metrics] ⚠️ Failed to log API usage:', error.message);
  } catch (err) {
    console.error('[metrics] ❌ Error logging API usage:', err?.message || String(err));
  }
}

export async function logQuotaError(apiKey, endpoint, err) {
  const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || 'unknown';
  const msg = err?.message || JSON.stringify(err);
  await logApiUsage({
    apiKey,
    endpoint,
    quotaCost: 0,
    status: 'error',
    errorCode: reason,
    errorMessage: msg,
  });
  if (apiKey) console.warn(`[quota] Logged quota error for key ${String(apiKey).slice(0, 8)}... → ${reason}`);
}

// Compatibility no-ops (legacy callers). These functions intentionally do nothing.
export async function startFetchRun() { return null; }
export async function finishFetchRun() { return; }
export async function startRefreshRun() { return null; }
export async function finishRefreshRun() { return; }

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

// Best-effort quota error logger; safe to call even without table present
export async function logQuotaError(apiKey, endpoint, err) {
  const prefix = apiKey ? apiKey.slice(0, 8) : 'unknown';
  const message = (err && (err.message || JSON.stringify(err))) || 'quota error';
  try {
    await supabase.from('api_usage').insert({
      api_key_hash: prefix,
      endpoint,
      quota_cost: null,
      status: 'error',
      error_code: 'quota',
      error_message: message,
    });
  } catch {}
}
