// backend/src/lib/persistence.js
// Safe persistence utilities with deduplication and schema verification.
// Maintains backward-compatible job_state and job_cursor helpers.

import { supabase } from './supabase.js';
import fs from 'fs';
import path from 'path';

function isoNow() {
  return new Date().toISOString();
}

// 1️⃣ Deduplication helpers
export function dedupeTracks(tracks = []) {
  const map = new Map();
  for (const t of tracks || []) {
    const key = t?.external_id;
    if (!key) continue;
    if (!map.has(key)) map.set(key, t);
  }
  return Array.from(map.values());
}

export function dedupePlaylistTracks(rows = []) {
  const map = new Map();
  for (const r of rows || []) {
    const key = `${r?.playlist_id}-${r?.track_id}`;
    if (!map.has(key)) map.set(key, r);
  }
  return Array.from(map.values());
}

// 2️⃣ Safe upserts with dedupe (chunked)
export async function upsertTracksSafe(tracks = [], chunkSize = 500) {
  const before = tracks.length;
  const deduped = dedupeTracks(tracks);
  if (before !== deduped.length) {
    console.log(`[persistence] 🧹 deduped tracks: ${before} → ${deduped.length}`);
  }
  for (let i = 0; i < deduped.length; i += chunkSize) {
    const chunk = deduped.slice(i, i + chunkSize).map(t => ({ ...t }));
    const { error } = await supabase.from('tracks').upsert(chunk, { onConflict: 'external_id' });
    if (error) console.warn('[persistence] ⚠️ upsert tracks chunk failed:', error.message);
  }
  return deduped.length;
}

export async function upsertPlaylistTracksSafe(rows = [], chunkSize = 500) {
  const before = rows.length;
  const deduped = dedupePlaylistTracks(rows);
  if (before !== deduped.length) {
    console.log(`[persistence] 🧹 deduped playlist_tracks: ${before} → ${deduped.length}`);
  }
  for (let i = 0; i < deduped.length; i += chunkSize) {
    const chunk = deduped.slice(i, i + chunkSize).map(r => ({ ...r }));
    const { error } = await supabase.from('playlist_tracks').upsert(chunk, { onConflict: 'playlist_id,track_id' });
    if (error) console.warn('[persistence] ⚠️ upsert playlist_tracks chunk failed:', error.message);
  }
  return deduped.length;
}

// 3️⃣ Schema verification and auto-migration
export async function verifySupabaseSchema() {
  const sql = `BEGIN;\nALTER TABLE public.tracks ADD CONSTRAINT IF NOT EXISTS tracks_external_id_key UNIQUE (external_id);\nALTER TABLE public.playlist_tracks ADD CONSTRAINT IF NOT EXISTS playlist_tracks_unique UNIQUE (playlist_id, track_id);\nCOMMIT;`;
  try {
    // Write file for documentation
    const target = path.resolve(process.cwd(), 'backend/sql/2025-11-07_verify_constraints.sql');
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `BEGIN;\nALTER TABLE public.tracks ADD CONSTRAINT IF NOT EXISTS tracks_external_id_key UNIQUE (external_id);\nALTER TABLE public.playlist_tracks ADD CONSTRAINT IF NOT EXISTS playlist_tracks_unique UNIQUE (playlist_id, track_id);\nCOMMIT;\n`);
    } catch (e) {
      console.warn('[persistence] ⚠️ Could not write SQL verification file:', e?.message || String(e));
    }

    // Attempt to execute via possible RPC entrypoints if present
    const candidates = [
      ['exec_sql', { sql }],
      ['execute_sql', { sql }],
      ['run_sql', { sql }],
    ];
    let executed = false;
    for (const [fn, payload] of candidates) {
      try {
        const { error } = await supabase.rpc(fn, payload);
        if (!error) { executed = true; break; }
      } catch {}
    }
    if (executed) {
      console.log('[persistence] 🔧 Supabase constraints verified/created');
    } else {
      console.log('[persistence] 🔧 Supabase constraints script generated; automatic execution unavailable (no RPC).');
    }
  } catch (e) {
    console.warn('[persistence] ⚠️ verifySupabaseSchema encountered an error:', e?.message || String(e));
  }
}

// 4️⃣ Backward-compatible job_state and job_cursor helpers
const STATE_TABLE = 'job_state';
const CURSOR_TABLE = 'job_cursor';

export async function getJobState(key) {
  const { data, error } = await supabase
    .from(STATE_TABLE)
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

export async function setJobState(key, value) {
  const payload = { key, value, updated_at: isoNow() };
  const { error } = await supabase
    .from(STATE_TABLE)
    .upsert(payload, { onConflict: 'key' });
  if (error) throw error;
  return true;
}

export async function getJobCursor(job_name) {
  const { data, error } = await supabase
    .from(CURSOR_TABLE)
    .select('cursor')
    .eq('job_name', job_name)
    .maybeSingle();
  if (error) throw error;
  return data?.cursor ?? null;
}

export async function setJobCursor(job_name, cursorObject) {
  if (cursorObject == null) {
    // clear row
    const { error } = await supabase
      .from(CURSOR_TABLE)
      .delete()
      .eq('job_name', job_name);
    if (error) throw error;
    return true;
  }
  const payload = { job_name, cursor: cursorObject, updated_at: isoNow() };
  const { error } = await supabase
    .from(CURSOR_TABLE)
    .upsert(payload, { onConflict: 'job_name' });
  if (error) throw error;
  return true;
}

export default {
  dedupeTracks,
  dedupePlaylistTracks,
  upsertTracksSafe,
  upsertPlaylistTracksSafe,
  verifySupabaseSchema,
  getJobState,
  setJobState,
  getJobCursor,
  setJobCursor,
};
