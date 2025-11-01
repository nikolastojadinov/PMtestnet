// 🔄 CLEANUP DIRECTIVE
// Full rewrite — remove any previous code or duplicate Supabase client instances before applying this version.

import { sb, initSupabase } from "../lib/supabase.js";
import { getTracksFromYouTube } from "../lib/youtube.js";

/**
 * Fetch and sync all tracks for a given playlist into Supabase.
 * Uses the shared Supabase client to ensure writes persist in the main database.
 */

export async function fetchTracksFromPlaylist(playlist) {
  await initSupabase();

  try {
    console.log(`[tracks] Fetching: ${playlist.title}`);

    // 1️⃣ Fetch all tracks from YouTube API
    const tracks = await getTracksFromYouTube(playlist.external_id);

    if (!tracks || tracks.length === 0) {
      console.warn(`[tracks] ${playlist.title}: no tracks found.`);
      return;
    }

    // 2️⃣ Prepare track objects for insertion
    const prepared = tracks.map((t) => ({
      source: "youtube",
      external_id: t.id,
      title: t.title,
      artist: t.artist || null,
      duration: t.duration || null,
      cover_url: t.cover || null,
      created_at: new Date().toISOString(),
      sync_status: "synced",
      last_synced_at: new Date().toISOString(),
    }));

    // 3️⃣ Insert into Supabase
    const { data: inserted, error } = await sb
      .from("tracks")
      .insert(prepared)
      .select("id");

    if (error) {
      console.warn(`[tracks] ${playlist.title}: insert error → ${error.message}`);
      return;
    }

    console.log(`[tracks] ${playlist.title}: +${inserted.length} tracks synced`);
  } catch (err) {
    console.warn(`[tracks] ${playlist.title}: failed → ${err.message}`);
  }
}
