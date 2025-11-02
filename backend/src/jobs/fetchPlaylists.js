// ✅ v3.9 — Fetch YouTube playlists and sync to Supabase

import { fetchYouTubePlaylists } from '../lib/youtube.js';
import supabase from '../lib/supabase.js';

export async function runFetchPlaylists() {
  console.log('[playlists] Starting YouTube playlist fetch job...');

  try {
    const playlists = await fetchYouTubePlaylists();
    if (!playlists || playlists.length === 0) {
      console.log('[playlists] ⚠️ No playlists fetched from YouTube.');
      return;
    }

    console.log(`[playlists] Received ${playlists.length} playlists from API.`);

    const formatted = playlists.map(pl => ({
      external_id: pl.id || pl.playlistId,
      title: pl.snippet?.title || 'Untitled Playlist',
      description: pl.snippet?.description || '',
      cover_url: pl.snippet?.thumbnails?.high?.url || null,
      region: pl.region || 'GLOBAL',
      category: 'music',
      is_public: true,
      created_at: new Date().toISOString(),
      fetched_on: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('playlists')
      .upsert(formatted, { onConflict: 'external_id' });

    if (error) {
      console.error('[playlists] ❌ Failed to upsert playlists:', error.message);
      return;
    }

    console.log(`[playlists] ✅ ${formatted.length} playlists synced to Supabase.`);
  } catch (err) {
    console.error('[playlists] ❌ Error in runFetchPlaylists:', err.message);
  }
}
