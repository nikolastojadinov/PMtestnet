// backend/src/lib/persistence.js
// Thin wrappers for durable job state using Supabase tables:
// job_state(key text primary key, value jsonb, updated_at timestamptz default now())
// job_cursor(job_name text primary key, cursor jsonb, updated_at timestamptz default now())

import { supabase } from './supabase.js';

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
  const payload = { key, value, updated_at: new Date().toISOString() };
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
  const payload = { job_name, cursor: cursorObject, updated_at: new Date().toISOString() };
  const { error } = await supabase
    .from(CURSOR_TABLE)
    .upsert(payload, { onConflict: 'job_name' });
  if (error) throw error;
  return true;
}

export default {
  getJobState,
  setJobState,
  getJobCursor,
  setJobCursor,
};
