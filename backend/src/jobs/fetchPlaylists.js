// backend/src/jobs/fetchPlaylists.js
// ✅ Daily: bira ~8 regiona + GLOBAL; upsert u 'playlists'
// ✅ Deduplication po external_id da spreči "ON CONFLICT DO UPDATE" grešku

import supabase from '../lib/supabase.js';
import { pickTodayRegions } from '../lib/utils.js';
import { fetchRegionPlaylists } from '../lib/youtube.js';

export async function runFetchPlaylists() {
  console.log('[playlists] Starting YouTube playlist fetch job...');

  const regions = pickTodayRegions(8);
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
  console.log(`[playlists] ✅ Deduplicated playlists: ${uniquePlaylists.length}`);

  const nowIso = new Date().toISOString();
  const formatted = uniquePlaylists.map(pl => ({
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

  // 🪣 Upsert u Supabase
  const { error } = await supabase
    .from('playlists')
    .upsert(formatted, { onConflict: 'external_id' });

  if (error) {
    console.error('[playlists] ❌ Failed to upsert playlists:', error.message);
    return;
  }

  console.log(`[playlists] ✅ ${formatted.length} playlists synced to Supabase.`);
}
