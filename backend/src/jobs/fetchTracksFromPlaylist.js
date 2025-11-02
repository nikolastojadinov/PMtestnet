// ✅ FULL REWRITE v5.3 — Fetch tracks from playlists and sync to Supabase

import { fetchTracksFromPlaylist } from '../lib/youtube.js';
import supabase from '../lib/supabase.js';

export async function runFetchTracks(playlists = []) {
  console.log(`[tracks] 🎵 Starting track fetch job for ${playlists.length} playlists...`);

  if (!Array.isArray(playlists) || playlists.length === 0) {
    console.warn('[tracks] ⚠️ No playlists provided for track fetching.');
    return;
  }

  let totalTracks = 0;

  for (const playlistId of playlists) {
    try {
      console.log(`[tracks] ▶️ Fetching tracks from playlist ${playlistId}...`);
      const tracks = await fetchTracksFromPlaylist(playlistId);

      if (!tracks?.length) {
        console.warn(`[tracks] ⚠️ No tracks found in playlist ${playlistId}`);
        continue;
      }

      const formatted = tracks.map((t) => ({
        external_id: t.id,
        title: t.title || 'Untitled Track',
        artist: t.artist || 'Unknown Artist',
        duration: t.duration || null,
        cover_url: t.cover_url || null,
        source: 'youtube',
        created_at: new Date().toISOString(),
        sync_status: 'ok',
        last_synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('tracks')
        .upsert(formatted, { onConflict: 'external_id' });

      if (error) {
        console.error(`[tracks] ❌ Supabase upsert failed for playlist ${playlistId}:`, error.message);
        continue;
      }

      console.log(`[tracks] ✅ ${formatted.length} tracks synced from playlist ${playlistId}`);
      totalTracks += formatted.length;
      await new Promise((res) => setTimeout(res, 1000));
    } catch (err) {
      console.error(`[tracks] ❌ Error fetching tracks from ${playlistId}:`, err.message);
    }
  }

  console.log(`[tracks] 🏁 Finished. Total tracks synced: ${totalTracks}`);
}
