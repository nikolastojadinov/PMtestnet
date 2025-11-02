// ✅ FULL REWRITE v3.9 — Fetch Tracks From Each Playlist (Music only, Supabase sync)

import { sleep, nextKeyFactory } from '../lib/utils.js';
import supabase from '../lib/supabase.js';
import fetch from 'node-fetch';

const YOUTUBE_API_KEYS = process.env.YOUTUBE_API_KEYS?.split(',').map(k => k.trim()).filter(Boolean);
const getNextApiKey = nextKeyFactory(YOUTUBE_API_KEYS);

// 🎵 fetch single playlist items (videos)
async function fetchPlaylistItems(playlistId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();

  if (!data.items) {
    console.warn(`[tracks] ⚠️ No items for playlist ${playlistId}`);
    return [];
  }

  return data.items.map(item => ({
    videoId: item.contentDetails?.videoId,
    title: item.snippet?.title || 'Untitled Track',
    artist: item.snippet?.videoOwnerChannelTitle || 'Unknown Artist',
    cover_url: item.snippet?.thumbnails?.high?.url || null,
  }));
}

// 🧠 main job
export async function fetchTracksFromPlaylist(playlistIds = []) {
  console.log(`[tracks] 🎧 Starting track fetch for ${playlistIds.length} playlists...`);
  if (!YOUTUBE_API_KEYS?.length) throw new Error('No YOUTUBE_API_KEYS configured');

  for (const playlistId of playlistIds) {
    const apiKey = getNextApiKey();
    try {
      const tracks = await fetchPlaylistItems(playlistId, apiKey);
      if (!tracks.length) continue;

      const formatted = tracks.map(t => ({
        source: 'youtube',
        external_id: t.videoId,
        title: t.title,
        artist: t.artist,
        cover_url: t.cover_url,
        duration: null,
        created_at: new Date().toISOString(),
        sync_status: 'ok',
        last_synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('tracks')
        .upsert(formatted, { onConflict: 'external_id' });

      if (error) {
        console.error(`[tracks] ❌ Failed to insert tracks for ${playlistId}:`, error.message);
        continue;
      }

      console.log(`[tracks] ✅ ${formatted.length} tracks synced from playlist ${playlistId}`);
    } catch (err) {
      console.error(`[tracks] ❌ Error fetching playlist ${playlistId}:`, err.message);
    }

    await sleep(1500); // rate limiting
  }

  console.log('[tracks] ✅ Track fetch cycle completed.');
}
