// backend/src/jobs/fetchTracksFromPlaylist.js
// ✅ Prima listu playlist ID-ova (external_id), skida do ~200 itema po listi i upsert u 'tracks'
// ⚠️ Namerno ne postavljamo 'sync_status' da ne bismo kačili CHECK constraint.

import supabase from '../lib/supabase.js';
import { fetchPlaylistItems } from '../lib/youtube.js';

function mapItemToTrack(it) {
  const vid = it?.contentDetails?.videoId;
  const sn = it?.snippet;
  return {
    source: 'youtube',
    external_id: vid || null,
    title: sn?.title || 'Untitled',
    artist: sn?.videoOwnerChannelTitle || sn?.channelTitle || null,
    duration: null, // može se naknadno dopuniti via videos.list (contentDetails.duration)
    cover_url: sn?.thumbnails?.high?.url
      || sn?.thumbnails?.medium?.url
      || sn?.thumbnails?.default?.url
      || null,
    created_at: new Date().toISOString()
  };
}

export async function fetchTracksFromPlaylist(targetPlaylistIds = []) {
  if (!Array.isArray(targetPlaylistIds) || targetPlaylistIds.length === 0) {
    console.log('[tracks] ⚠️ No target playlists provided.');
    return;
  }

  for (const pid of targetPlaylistIds) {
    console.log(`[tracks] Fetching tracks for playlist: ${pid}`);
    try {
      const items = await fetchPlaylistItems(pid, 4); // 4*50 = ~200
      if (!items.length) {
        console.log(`[tracks] ⚠️ No items for ${pid}`);
        continue;
      }
      const rows = items.map(mapItemToTrack).filter(r => r.external_id);
      if (!rows.length) {
        console.log(`[tracks] ⚠️ No mappable items for ${pid}`);
        continue;
      }
      const { error } = await supabase
        .from('tracks')
        .upsert(rows, { onConflict: 'external_id' });

      if (error) {
        console.error(`[tracks] ❌ Failed to upsert tracks for ${pid}: ${error.message}`);
      } else {
        console.log(`[tracks] ✅ Upserted ${rows.length} tracks for ${pid}`);
      }
    } catch (e) {
      console.error(`[tracks] ❌ Error on ${pid}: ${e.message}`);
    }
  }

  console.log('[tracks] 🎵 All target playlists processed.');
}
