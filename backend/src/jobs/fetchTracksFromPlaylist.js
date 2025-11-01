// ✅ FULL REWRITE v3.6 — Fetch tracks from YouTube playlists and save to Supabase

import { fetchPlaylistItems } from '../lib/youtube.js';
import { supabase } from '../lib/supabase.js';

export async function runFetchTracks() {
  console.log('[tracks] Starting playlist track fetch job...');

  try {
    // Uzimamo sve playliste iz Supabase koje imaju validan external_id
    const { data: playlists, error: plError } = await supabase
      .from('playlists')
      .select('id, external_id, title')
      .not('external_id', 'is', null)
      .limit(1000);

    if (plError) throw plError;
    if (!playlists || playlists.length === 0) {
      console.log('[tracks] ⚠️ No playlists found.');
      return;
    }

    for (const playlist of playlists) {
      console.log(`[tracks] Fetching tracks for: ${playlist.title}`);

      // ✅ koristi novu funkciju iz youtube.js
      const items = await fetchPlaylistItems(playlist.external_id);

      if (!items || items.length === 0) {
        console.log(`[tracks] ⚠️ No tracks found for ${playlist.title}`);
        continue;
      }

      // Mapiramo YouTube iteme u tracks format
      const tracks = items.map(item => ({
        source: 'youtube',
        external_id: item.contentDetails?.videoId || null,
        title: item.snippet?.title || 'Untitled',
        artist: item.snippet?.videoOwnerChannelTitle || 'Unknown Artist',
        duration: null,
        cover_url: item.snippet?.thumbnails?.high?.url || null,
        created_at: new Date().toISOString(),
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      })).filter(t => t.external_id);

      // Upisujemo pesme u Supabase
      const { error: insertError } = await supabase
        .from('tracks')
        .upsert(tracks, { onConflict: 'external_id' });

      if (insertError) {
        console.error(`[tracks] ❌ Failed to upsert tracks for ${playlist.title}:`, insertError.message);
        continue;
      }

      console.log(`[tracks] ${playlist.title}: +${tracks.length} tracks synced`);
    }

    console.log('[tracks] 🎵 All playlists processed.');
  } catch (err) {
    console.error('[tracks] ❌ Error in runFetchTracks:', err.message);
  }
}
