// backend/src/lib/metrics.js
// ✅ Definitive API usage metrics logger
// - Logs all API calls to Supabase (api_usage)
// - Safe SHA-256 hashing of API keys
// - Non-blocking for fetch flows (errors are caught and only logged)
// - Compatible with logQuotaError() calls from playlist discovery

import crypto from 'crypto';
import { supabase } from './supabase.js';

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

