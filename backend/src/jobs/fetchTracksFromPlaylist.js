// 🔄 CLEANUP DIRECTIVE
// Full rewrite — remove any previous code or partial functions before applying this version.

import { sb } from '../lib/supabase.js';
import { getTracksFromYouTube } from '../lib/youtube.js';

/**
 * ✅ Fetches all tracks for playlists marked as "new" or "refresh"
 * and writes them into the Supabase 'tracks' table in batches.
 */
export async function runFetchTracks() {
  console.log('[tracks] 🚀 Starting full track synchronization...');

  const { data: playlists, error: plErr } = await sb
    .from('playlists')
    .select('id, external_id, title')
    .in('sync_status', ['new', 'refresh'])
    .limit(100);

  if (plErr) {
    console.error('[tracks] ❌ Playlist fetch error:', plErr.message);
    return;
  }

  if (!playlists || playlists.length === 0) {
    console.log('[tracks] ✅ No playlists to sync.');
    return;
  }

  for (const pl of playlists) {
    console.log(`[tracks] Fetching ${pl.title}...`);
    const tracks = await getTracksFromYouTube(pl.external_id);

    if (!tracks || tracks.length === 0) {
      console.warn(`[tracks] ⚠️ No tracks found for ${pl.title}`);
      continue;
    }

    // Insert tracks in safe batches
    const batchSize = 200;
    for (let i = 0; i < tracks.length; i += batchSize) {
      const batch = tracks.slice(i, i + batchSize);
      const { error: insErr } = await sb.from('tracks').upsert(
        batch.map((t) => ({
          source: 'youtube',
          external_id: t.id,
          title: t.title,
          artist: t.artist,
          cover_url: t.cover,
          created_at: new Date().toISOString(),
          sync_status: 'ready'
        })),
        { onConflict: 'external_id' }
      );
      if (insErr) {
        console.error(`[tracks] ❌ Insert batch error (${pl.title}):`, insErr.message);
      }
    }

    // Mark playlist as synced
    await sb
      .from('playlists')
      .update({
        item_count: tracks.length,
        sync_status: 'done',
        last_synced_at: new Date().toISOString()
      })
      .eq('id', pl.id);

    console.log(`[tracks] ✅ ${pl.title}: +${tracks.length} tracks synced`);
  }

  console.log('[tracks] 🎵 All playlists processed.');
}
