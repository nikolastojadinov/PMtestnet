// ✅ FULL REWRITE v5.2 — YouTube Music Playlists Fetch Job
// 🔹 Preuzima najpopularnije muzičke YouTube plejliste (categoryId = 10)
// 🔹 Koristi YouTube API key rotaciju iz utils.js (nextKeyFactory)
// 🔹 Čuva plejliste u Supabase tabeli `playlists`
// 🔹 Pokreće se svakog dana u 11:05 (lokalno vreme, 10:05 UTC)

import { fetchYouTubePlaylists } from '../lib/youtube.js';
import supabase from '../lib/supabase.js';
import { pickTodayRegions } from '../lib/utils.js';

export async function runFetchPlaylists() {
  console.log('[playlists] 🎧 Starting YouTube playlist fetch job...');

  try {
    // 📍 Izaberi 8 regiona za današnji ciklus
    const regions = pickTodayRegions(8);
    console.log(`[playlists] 🌍 Regions selected for today: ${regions.join(', ')}`);

    let totalPlaylists = [];

    for (const region of regions) {
      console.log(`[playlists] ▶️ Fetching playlists for region: ${region}`);
      const regionPlaylists = await fetchYouTubePlaylists(region, 50);
      if (regionPlaylists?.length) {
        totalPlaylists = totalPlaylists.concat(regionPlaylists);
        console.log(`[playlists] ✅ ${regionPlaylists.length} playlists fetched for ${region}`);
      } else {
        console.warn(`[playlists] ⚠️ No playlists found for ${region}`);
      }
      // Mali delay između regiona radi sigurnosti
      await new Promise((res) => setTimeout(res, 1500));
    }

    if (!totalPlaylists.length) {
      console.warn('[playlists] ⚠️ No playlists fetched from YouTube at all.');
      return;
    }

    console.log(`[playlists] 🗂️ Preparing ${totalPlaylists.length} playlists for Supabase sync...`);

    // 📦 Formatiranje za Supabase upsert
    const formatted = totalPlaylists.map((pl) => ({
      external_id: pl.id || pl.playlistId,
      title: pl.title || pl.snippet?.title || 'Untitled Playlist',
      description: pl.description || pl.snippet?.description || '',
      cover_url: pl.thumbnails?.high?.url || pl.snippet?.thumbnails?.high?.url || null,
      region: pl.region || 'GLOBAL',
      category: 'music',
      is_public: true,
      created_at: new Date().toISOString(),
      fetched_on: new Date().toISOString(),
    }));

    // 💾 Upsert u Supabase
    const { error } = await supabase
      .from('playlists')
      .upsert(formatted, { onConflict: 'external_id' });

    if (error) {
      console.error('[playlists] ❌ Supabase upsert failed:', error.message);
      return;
    }

    console.log(`[playlists] ✅ ${formatted.length} playlists successfully synced to Supabase.`);
  } catch (err) {
    console.error('[playlists] ❌ Fatal error in runFetchPlaylists:', err.message);
  }
}
