// backend/src/jobs/selectEmptyPlaylists.js
// Single writer for the selection list persisted in job_state (key='tracks_window_selection').
// Uses TTL to avoid overwriting mid-window.

import { supabase } from '../lib/supabase.js';
import { getJobState, setJobState } from '../lib/persistence.js';

const SELECTION_KEY = 'tracks_window_selection';
const TTL_MS = 3 * 60 * 60 * 1000; // 3h

function nowIso() {
  return new Date().toISOString();
}

function isValidSelection(sel) {
  if (!sel || !Array.isArray(sel.items)) return false;
  if (!sel.created_at) return false;
  const age = Date.now() - new Date(sel.created_at).getTime();
  return age >= 0 && age <= TTL_MS && sel.items.length > 0;
}

export async function selectEmptyPlaylists(limit = 500) {
  // Respect existing selection within TTL
  const existing = await getJobState(SELECTION_KEY);
  if (isValidSelection(existing)) {
    console.log(`[selectEmpty] Existing selection valid (items=${existing.items.length}) — skipping reselect.`);
    return existing.items.map((it) => it.id);
  }

  // Fetch candidates via RPC get_empty_playlists
  const { data, error } = await supabase
    .rpc('get_empty_playlists', { limit_count: limit });
  if (error) throw error;
  const items = (data || []).map((row) => ({ id: row.id }));

  const selection = {
    window_id: `w_${Date.now()}`,
    created_at: nowIso(),
    items,
  };
  await setJobState(SELECTION_KEY, selection);
  console.log(`[selectEmpty] ✅ Persisted selection with ${items.length} playlists.`);
  return items.map((x) => x.id);
}

export default { selectEmptyPlaylists };
