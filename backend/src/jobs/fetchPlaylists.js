// ✅ Large-scale YouTube playlist fetcher — 6000+ daily
// ✅ Compatible with existing Supabase schema
// ✅ Uses fetchRegionPlaylists() from lib/youtube.js
// ✅ No new columns required

import { createClient } from '@supabase/supabase-js';
import { pickTodayRegions, updateRegionScore, sleep } from '../lib/utils.js';
import { fetchRegionPlaylists } from '../lib/youtube.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const DAILY_REGION_COUNT = 40; // koliko regiona dnevno
const TARGET_PLAYLISTS = 6000; // ukupno playlisti dnevno

export async function runFetchPlaylists() {
  console.log('[playlists] 🚀 Starting YouTube playlist fetch job...');
  const regions = pickTodayRegions(DAILY_REGION_COUNT);
  console.log(`[youtube] 🌍 Fetching playlists for regions: ${regions.join(', ')}`);

  let all = [];
  for (const region of regions) {
    try {
      const playlists = await fetchRegionPlaylists([region]);
      updateRegionScore(region, playlists.length);
      all.push(...playlists);
      await sleep(400);
    } catch (err) {
      console.log(`[youtube] ⚠️ Error in region ${region}: ${err.message}`);
      await sleep(1000);
    }
  }

  console.log(`[youtube] 🎵 Total playlists fetched: ${all.length}`);

  // 🔁 Deduplicate by playlistId + region combo
  const seen = new Set();
  const unique = [];
  for (const p of all) {
    const key = `${p.id}_${p.region}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({
        external_id: p.id,
        title: p.snippet?.title || 'Untitled',
        description: p.snippet?.description || '',
        cover_url: p.snippet?.thumbnails?.high?.url || p.snippet?.thumbnails?.default?.url || null,
        region: p.region,
        category: '10',
        is_public: true,
        // ✅ Removed "channelTitle" to match existing Supabase schema
        created_at: new Date().toISOString(),
        fetched_on: new Date().toISOString(),
      });
    }
  }

  console.log(`[playlists] ✅ Deduplicated: ${unique.length} playlists`);

  // 🗄️ Upsert into Supabase (using only existing columns)
  const { error } = await supabase
    .from('playlists')
    .upsert(unique, { onConflict: 'external_id,region' });

  if (error) {
    console.error('[playlists] ❌ Failed to upsert playlists:', error.message);
  } else {
    console.log(`[playlists] ✅ ${unique.length} playlists synced to Supabase.`);
  }
}
