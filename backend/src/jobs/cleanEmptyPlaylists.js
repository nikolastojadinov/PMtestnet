// ✅ FULL REWRITE v3.7 — Clean empty playlists from Supabase

import supabase from '../lib/supabase.js';

export async function runCleanEmptyPlaylists() {
  console.log('[cleanup] Checking for empty playlists...');

  try {
    const { data: playlists, error } = await supabase
      .from('playlists')
      .select('id, title')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!playlists || playlists.length === 0) {
      console.log('[cleanup] ⚠️ No playlists found.');
      return;
    }

    for (const playlist of playlists) {
      const { count, error: countError } = await supabase
        .from('playlist_tracks')
        .select('id', { count: 'exact', head: true })
        .eq('playlist_id', playlist.id);

      if (countError) {
        console.error(`[cleanup] ❌ Count error for ${playlist.title}:`, countError.message);
        continue;
      }

      if (!count || count === 0) {
        const { error: delError } = await supabase
          .from('playlists')
          .delete()
          .eq('id', playlist.id);

        if (delError) {
          console.error(`[cleanup] ❌ Delete failed for ${playlist.title}:`, delError.message);
          continue;
        }

        console.log(`[cleanup] 🧹 Deleted empty playlist: ${playlist.title}`);
      }
    }

    console.log('[cleanup] ✅ Finished cleaning empty playlists.');
  } catch (err) {
    console.error('[cleanup] ❌ Error in runCleanEmptyPlaylists:', err.message);
  }
}
