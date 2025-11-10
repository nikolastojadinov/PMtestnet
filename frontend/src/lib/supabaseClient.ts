// frontend/src/lib/supabaseClient.ts
// Full rewrite: standard browser Supabase client with helpers
// Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (or VITE_* fallbacks)
// Exports: supabase, upsertUser, logStatistic, detectDevice, detectCountry, getUserByPiUid, updateUserByPiUid

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Resolve environment variables gracefully for Vite or Next naming conventions.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[supabase] Missing URL or anon key environment variables — user sync disabled');
} else {
  supabase = createClient(SUPABASE_URL as string, SUPABASE_KEY as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export { supabase };

export type PurpleUser = {
  pi_uid: string;
  username: string | null;
  wallet: string | null;
  language: string | null;
  user_consent: boolean;
  country?: string | null;
};

/** Upsert a Purple Music user into the users table. */
export async function upsertUser(user: PurpleUser) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') };
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert([user], { onConflict: 'pi_uid' })
      .select();
    if (error) return { data: null, error };
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e };
  }
}

/** Log login statistic (best-effort). */
export async function logStatistic(action: string, device: string, meta: Record<string, any> = {}) {
  if (!supabase) return;
  try {
    await supabase.from('statistics').insert({ action, device, meta });
  } catch (e) {
    console.warn('[statistics] failed to log', action, (e as any)?.message || String(e));
  }
}

/** Detect approximate device category using userAgent heuristics. */
export function detectDevice(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) return 'mobile';
  if (/tablet/.test(ua)) return 'tablet';
  return 'desktop';
}

/** Country detection (fallback to navigator.language region part). */
export function detectCountry(): string | null {
  try {
    const lang = navigator.language; // e.g. en-US
    const parts = lang.split('-');
    return parts.length > 1 ? parts[1].toUpperCase() : null;
  } catch { return null; }
}

// Extra helpers for payments/session flows
export async function getUserByPiUid(pi_uid: string) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') };
  const { data, error } = await supabase.from('users').select('*').eq('pi_uid', pi_uid).maybeSingle();
  return { data, error };
}

export async function updateUserByPiUid(pi_uid: string, patch: Record<string, any>) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') };
  const { data, error } = await supabase.from('users').update(patch).eq('pi_uid', pi_uid).select();
  return { data, error };
}
