// backend/src/jobs/fetchPlaylists.js
// ✅ 70-region rotation system
// ✅ Deduplication, 6000 daily playlists limit
// ✅ Safe upsert (no ON CONFLICT error)
// ✅ Ready for Render deployment

import supabase from '../lib/supabase.js';
import { pickTodayRegions } from '../lib/utils.js';
import { fetchRegionPlaylists } from '../lib/youtube.js';

export async function runFetchPlaylists() {
  console.log('[playlists] Starting YouTube playlist fetch job...');

  // 🔁 Rotate through all 70 regions (8–10 per day)
  const regions = pickTodayRegions(10);
  console.log(`[youtube] 🌍 Fetching playlists for regions: ${regions.join(', ')}`);

  const playlists = await fetchRegionPlaylists(regions);
  if (!playlists?.length) {
    console.log('[playlists] ⚠️ No playlists fetched from YouTube.');
    return;
  }

  // 🧹 Deduplicate by external_id
  const uniqueMap = new Map();
  for (const pl of playlists) {
    if (!pl?.id) continue;
    if (!uniqueMap.has(pl.id)) uniqueMap.set(pl.id, pl);
  }
  const uniquePlaylists = Array.from(uniqueMap.values());

  // 🧩 Limit to 6000 daily playlists (safe cap)
  const limitedPlaylists = uniquePlaylists.slice(0, 6000);
  console.log(`[playlists] ✅ Deduplicated + limited to ${limitedPlaylists.length} playlists.`);

  const nowIso = new Date().toISOString();
  const formatted = limitedPlaylists.map(pl => ({
    external_id: pl.id,
    title: pl.snippet?.title || 'Untitled Playlist',
    description: pl.snippet?.description || '',
    cover_url: pl.snippet?.thumbnails?.high?.url
      || pl.snippet?.thumbnails?.medium?.url
      || pl.snippet?.thumbnails?.default?.url
      || null,
    region: pl.region || 'GLOBAL',
    category: 'music',
    is_public: true,
    created_at: nowIso,
    fetched_on: nowIso
  }));

  // 🪣 Safe upsert into Supabase
  const { error } = await supabase
    .from('playlists')
    .upsert(formatted, { onConflict: 'external_id' });

  if (error) {
    console.error('[playlists] ❌ Failed to upsert playlists:', error.message);
    return;
  }

  console.log(`[playlists] ✅ ${formatted.length} playlists synced to Supabase.`);
}
