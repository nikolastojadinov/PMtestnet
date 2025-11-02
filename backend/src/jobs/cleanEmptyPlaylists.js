// cleanup directive: full rewrite of this file before applying changes

import { supabase } from './supabase.js';

/**
 * Selects empty playlists for the next fetch cycle instead of deleting them.
 * Returns up to 1000 (5×200) playlists that currently have no tracks linked.
 */
export async function cleanEmptyPlaylists() {
  console.log('[cleanEmptyPlaylists] 🔍 Selecting up to 1000 empty playlists...');

  // Find playlists that do NOT have any linked tracks
  const { data, error } = await supabase.rpc('get_empty_playlists', { limit_count: 1000 });

  // If RPC is not available, fallback to a direct query
  if (error || !data) {
    console.warn('[cleanEmptyPlaylists] ⚠️ RPC not found or failed, using fallback query...');

    const { data: fallback, error: fallbackError } = await supabase
      .from('playlists')
      .select('id, title, region')
      .not('id', 'in', supabase.from('playlist_tracks').select('playlist_id'))
      .is('is_public', true)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (fallbackError) {
      console.error('[cleanEmptyPlaylists] ❌ Error selecting playlists:', fallbackError);
      return [];
    }

    console.log(`[cleanEmptyPlaylists] ✅ Found ${fallback.length} empty playlists (fallback mode).`);
    return fallback.map(p => p.id);
  }

  console.log(`[cleanEmptyPlaylists] ✅ Found ${data.length} empty playlists ready for track fetching.`);
  return data.map(p => p.id);
}
