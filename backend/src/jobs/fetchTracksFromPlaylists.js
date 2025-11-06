// backend/src/jobs/fetchTracksFromPlaylists.js
// Resume-aware track fetcher that reads selection from job_state and persists cursor in job_cursor.

import { supabase } from '../lib/supabase.js';
import { fetchPlaylistItems } from '../lib/youtube.js';
import { getJobState, getJobCursor, setJobCursor } from '../lib/persistence.js';

const SELECTION_KEY = 'tracks_window_selection';
const CURSOR_NAME = 'fetch_tracks';

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function uniqueByKey(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, it);
  }
  return Array.from(m.values());
}

function mapItemToTrack(it) {
  const vid = it?.contentDetails?.videoId || it?.snippet?.resourceId?.videoId;
  const sn = it?.snippet;
  return {
    source: 'youtube',
    external_id: vid || null,
    title: sn?.title || 'Untitled',
    artist: sn?.videoOwnerChannelTitle || sn?.channelTitle || null,
    duration: null,
    cover_url:
      sn?.thumbnails?.high?.url ||
      sn?.thumbnails?.medium?.url ||
      sn?.thumbnails?.default?.url ||
      null,
  };
}

async function upsertTracksMinimal(rows) {
  // Defensive dedupe by external_id
  const deduped = uniqueByKey(rows.filter(r => r.external_id), r => r.external_id);

  // Try preferred sync_status values, fall back if DB has a CHECK
  const candidates = ['fetched', 'ready', 'new'];
  let lastErr;
  for (const status of candidates) {
    const withStatus = deduped.map(r => ({ ...r, sync_status: status }));
    const { data, error } = await supabase
      .from('tracks')
      .upsert(withStatus, { onConflict: 'external_id' })
      .select('id, external_id');
    if (!error) return data || [];
    lastErr = error;
    if (String(error.message || '').includes('tracks_sync_status_check')) {
      console.warn(`[tracks] sync_status '${status}' rejected by DB check; trying next…`);
      continue;
    }
    throw error;
  }
  throw lastErr || new Error('tracks upsert failed (sync_status)');
}

export async function runFetchTracksWindow(batchSize = 15) {
  // 1) Load persisted selection and cursor
  const selection = await getJobState(SELECTION_KEY);
  const items = Array.isArray(selection?.items) ? selection.items : [];
  if (!items.length) {
    console.log('[tracks] No selection found in job_state; skipping this window.');
    return;
  }
  const cursor = (await getJobCursor(CURSOR_NAME)) || { index: 0, last_playlist_id: null, window_id: selection.window_id };
  const startIndex = Math.max(0, parseInt(cursor.index || 0, 10));

  // 2) Process in small batches
  for (const group of chunk(items.slice(startIndex), batchSize)) {
    for (let i = 0; i < group.length; i++) {
      const sel = group[i];
      const idx = startIndex + (items.slice(startIndex, startIndex + group.length).indexOf(sel));
      const playlistUUID = sel.id || sel; // allow either shape

      try {
        // Lookup external_id
        const { data: plRow, error: plErr } = await supabase
          .from('playlists')
          .select('id, external_id')
          .eq('id', playlistUUID)
          .single();
        if (plErr || !plRow) {
          console.warn('[tracks] ⚠️ Playlist not found for id:', playlistUUID);
          await setJobCursor(CURSOR_NAME, { job_name: CURSOR_NAME, index: idx + 1, last_playlist_id: playlistUUID, updated_at: new Date().toISOString() });
          continue;
        }

        const ytPlaylistId = plRow.external_id;
        console.log(`[tracks] Fetching tracks for playlist ${playlistUUID} (YT ${ytPlaylistId})`);
        const items = await fetchPlaylistItems(ytPlaylistId, 4);
        if (!items.length) {
          await setJobCursor(CURSOR_NAME, { job_name: CURSOR_NAME, index: idx + 1, last_playlist_id: playlistUUID, updated_at: new Date().toISOString() });
          continue;
        }

        // Map → dedupe tracks
        const trackRows = uniqueByKey(items.map(mapItemToTrack).filter(r => r.external_id), r => `${r.source}:${r.external_id}`);
        const inserted = await upsertTracksMinimal(trackRows);
        const idByExternal = new Map((inserted || []).map(t => [t.external_id, t.id]));

        // Links (playlist_id, track_id), dedupe without position in key
        const links = uniqueByKey(
          (inserted || []).map((t, pos) => ({ playlist_id: plRow.id, track_id: t.id, position: pos, added_at: new Date().toISOString() })),
          l => `${l.playlist_id}:${l.track_id}`
        );

        // Insert links with DO NOTHING on conflict
        const { error: linkErr } = await supabase
          .from('playlist_tracks')
          .insert(links.map(l => ({ playlist_id: l.playlist_id, track_id: l.track_id, added_at: l.added_at })), {
            onConflict: 'playlist_id,track_id',
            ignoreDuplicates: true,
          });
        if (linkErr) throw linkErr;

        // Update positions separately (single-row targeted updates)
        for (const l of links) {
          await supabase
            .from('playlist_tracks')
            .update({ position: l.position })
            .eq('playlist_id', l.playlist_id)
            .eq('track_id', l.track_id);
        }

        // Update playlist refreshed time
        await supabase
          .from('playlists')
          .update({ last_refreshed_on: new Date().toISOString() })
          .eq('id', plRow.id);

        console.log(`[tracks] ✅ Linked ${links.length} tracks to playlist ${playlistUUID}`);
      } catch (e) {
        console.error(`[tracks] ❌ Error on ${playlistUUID}: ${e.message}`);
      }

      // Persist cursor after each playlist
      await setJobCursor(CURSOR_NAME, { job_name: CURSOR_NAME, index: (idx + 1), last_playlist_id: playlistUUID, updated_at: new Date().toISOString() });
    }
  }

  // Clear cursor when done; selection lifecycle is managed by selector job
  await setJobCursor(CURSOR_NAME, null);
  console.log('[tracks] 🎵 Window complete, cursor cleared.');
}

export default { runFetchTracksWindow };
