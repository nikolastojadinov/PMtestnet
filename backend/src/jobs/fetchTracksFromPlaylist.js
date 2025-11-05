// backend/src/jobs/fetchTracksFromPlaylist.js
// ✅ Accepts playlist UUID ids, fetches ~200 items per list, upserts tracks, and links via playlist_tracks

import { supabase } from '../lib/supabase.js';
import { fetchPlaylistItems } from '../lib/youtube.js';
import { sleep } from '../lib/utils.js';

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
    // Some DBs have a CHECK constraint on sync_status; provide valid default
    sync_status: 'fetched',
    created_at: new Date().toISOString(),
  };
}

export async function fetchTracksFromPlaylist(targetPlaylistUUIDs = []) {
  if (!Array.isArray(targetPlaylistUUIDs) || targetPlaylistUUIDs.length === 0) {
    console.log('[tracks] ⚠️ No target playlists provided.');
    return;
  }

  // Attempt bulk upsert with a set of candidate sync_status values to satisfy
  // environments that enforce a CHECK constraint on tracks.sync_status.
  async function tryUpsertTracks(rows) {
    // Prefer 'fetched', then fall back to other common states if a CHECK blocks it.
    const candidates = ['fetched', 'ready', 'new', 'queued', 'linked'];
    let lastErr;
    for (const status of candidates) {
      const rowsWithStatus = rows.map((r) => ({ ...r, sync_status: status }));
      const { data, error } = await supabase
        .from('tracks')
        .upsert(rowsWithStatus, { onConflict: 'external_id' })
        .select('id, external_id');
      if (!error) {
        if (status !== 'fetched') {
          console.warn(`[tracks] sync_status fallback accepted: '${status}' for ${rowsWithStatus.length} rows`);
        }
        return data || [];
      }
      lastErr = error;
      const msg = String(error?.message || '');
      if (msg.includes('tracks_sync_status_check')) {
        console.warn(`[tracks] sync_status '${status}' rejected by DB check; trying next…`);
        continue;
      }
      // Non-check errors: surface immediately
      throw error;
    }
    // If we exhausted candidates and still failed, throw the last error
    throw lastErr || new Error('tracks upsert failed due to sync_status constraint');
  }

  for (const playlistUUID of targetPlaylistUUIDs) {
    // Lookup external_id for YouTube API
    const { data: plRow, error: plErr } = await supabase
      .from('playlists')
      .select('id, external_id')
      .eq('id', playlistUUID)
      .single();
    if (plErr || !plRow) {
      console.warn('[tracks] ⚠️ Playlist not found for id:', playlistUUID);
      continue;
    }

    const ytPlaylistId = plRow.external_id;
    console.log(`[tracks] Fetching tracks for playlist ${playlistUUID} (YT ${ytPlaylistId})`);
    try {
      const items = await fetchPlaylistItems(ytPlaylistId, 4); // 4*50 ≈ 200
      if (!items.length) {
        console.log(`[tracks] ⚠️ No items for ${ytPlaylistId}`);
        continue;
      }
      const rows = items.map(mapItemToTrack).filter((r) => r.external_id);
      if (!rows.length) {
        console.log(`[tracks] ⚠️ No mappable items for ${ytPlaylistId}`);
        continue;
      }

      // Upsert tracks with safe sync_status handling and return ids
      const inserted = await tryUpsertTracks(rows);

      const idByExternal = new Map((inserted || []).map((t) => [t.external_id, t.id]));
      const rels = rows
        .map((r, idx) => ({
          playlist_id: plRow.id,
          track_id: idByExternal.get(r.external_id),
          added_at: new Date().toISOString(),
          position: idx,
        }))
        .filter((x) => !!x.track_id);

      const { error: relErr } = await supabase
        .from('playlist_tracks')
        .upsert(rels, { onConflict: 'playlist_id,track_id' });
      if (relErr) throw relErr;

      // Update playlist refreshed time
      await supabase
        .from('playlists')
        .update({ last_refreshed_on: new Date().toISOString() })
        .eq('id', plRow.id);

      console.log(`[tracks] ✅ Linked ${rels.length} tracks to playlist ${playlistUUID}`);
    } catch (e) {
      console.error(`[tracks] ❌ Error on ${playlistUUID}: ${e.message}`);
    }

    await sleep(300);
  }

  console.log('[tracks] 🎵 All target playlists processed.');
}
