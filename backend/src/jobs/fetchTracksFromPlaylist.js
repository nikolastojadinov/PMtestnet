// ✅ Adjusted imports to proper lib paths
import supabase from '../lib/supabase.js';
import { fetchPlaylistItems, getNextApiKey } from '../lib/youtube.js';
import { sleep } from '../lib/utils.js';

/**
 * Fetches tracks for playlists (provided by cleanEmptyPlaylists)
 * and upserts them into Supabase tables.
 * Each playlist fetches up to 200 tracks (YouTube API limit).
 */
export async function fetchTracksFromPlaylist(targetPlaylists = []) {
  console.log('[fetchTracksFromPlaylist] 🚀 Starting track fetch process...');

  if (!targetPlaylists || targetPlaylists.length === 0) {
    console.warn('[fetchTracksFromPlaylist] ⚠️ No target playlists provided, skipping fetch.');
    return;
  }

  for (const playlistId of targetPlaylists) {
  const apiKey = getNextApiKey();
  console.log(`[tracks] 🎵 Fetching tracks for playlist: ${playlistId} (API key ${apiKey || 'n/a'})`);

    try {
  const items = await fetchPlaylistItems(playlistId);

      if (!items || items.length === 0) {
        console.warn(`[tracks] ⚠️ No tracks returned for playlist ${playlistId}`);
        continue;
      }

      // Prepare rows for tracks
      const trackRows = items.map(item => ({
        source: 'youtube',
        external_id: item.contentDetails?.videoId || item.snippet?.resourceId?.videoId,
        title: item.snippet?.title || 'Untitled',
        artist: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || null,
        duration: null,
        cover_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
        created_at: new Date().toISOString(),
        sync_status: 'synced'
      }));

      // Upsert tracks
  const { error: trackError } = await supabase.from('tracks').upsert(trackRows, { onConflict: 'external_id' });
      if (trackError) throw trackError;

      // Link tracks to playlist
      const playlistTrackRows = trackRows.map((t, index) => ({
        playlist_id: playlistId,
        track_id: t.external_id,
        added_at: new Date().toISOString(),
        position: index
      }));

      const { error: linkError } = await supabase
        .from('playlist_tracks')
        .upsert(playlistTrackRows, { onConflict: 'playlist_id,track_id' });

      if (linkError) throw linkError;

      console.log(`[tracks] ✅ Upserted ${trackRows.length} tracks for playlist ${playlistId}`);
    } catch (err) {
      console.error(`[tracks] ❌ Failed to fetch tracks for playlist ${playlistId}:`, err.message || err);
    }

    await sleep(500); // small delay between playlists
  }

  console.log('[fetchTracksFromPlaylist] 🎶 Finished processing all target playlists.');
}
