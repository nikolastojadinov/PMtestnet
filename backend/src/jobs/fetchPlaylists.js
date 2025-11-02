// ✅ Full optimized version — fetch 6000+ playlists daily
// ✅ Uses 40-region rotation + key rotator + Supabase upsert
// ✅ Keeps all playlists (music only, categoryId=10)
// ✅ Compatible with scheduler @ 13:05 local (Europe/Budapest)

import { createClient } from '@supabase/supabase-js';
import { nextKeyFactory, pickTodayRegions, sleep, updateRegionScore } from '../lib/utils.js';
import { fetchYoutubePlaylists } from '../lib/youtube.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const apiKeys = (process.env.YOUTUBE_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean);
const nextKey = nextKeyFactory(apiKeys);

const MAX_REGIONS = 40; // ⚡️ increase for more playlists
const PLAYLISTS_PER_REGION = 150; // avg 150×40 = 6000
const CATEGORY_ID = '10'; // 🎵 Music

export async function runFetchPlaylists() {
  console.log('[playlists] 🚀 Starting large-scale YouTube playlist fetch...');
  const regions = pickTodayRegions(MAX_REGIONS);
  console.log(`[playlists] 🌍 Selected regions (${regions.length}): ${regions.join(', ')}`);

  let allPlaylists = [];

  for (const region of regions) {
    try {
      const key = nextKey();
      const fetched = await fetchYoutubePlaylists(region, CATEGORY_ID, PLAYLISTS_PER_REGION, key);
      updateRegionScore(region, fetched.length);
      console.log(`[youtube] ✅ ${region}: ${fetched.length} playlists`);
      allPlaylists.push(...fetched);
      await sleep(1500); // small delay between API calls
    } catch (err) {
      console.error(`[youtube] ❌ ${region} failed:`, err.message);
      await sleep(3000);
    }
  }

  console.log(`[youtube] 🎵 Total fetched before dedupe: ${allPlaylists.length}`);

  // 🔁 Deduplicate by external_id + region combo (so same playlist can exist in multiple regions)
  const unique = [];
  const seen = new Set();
  for (const p of allPlaylists) {
    const key = `${p.external_id}_${p.region}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  console.log(`[playlists] ✅ Deduplicated count: ${unique.length}`);

  // 🗄️ Insert into Supabase
  const { error } = await supabase.from('playlists').upsert(unique, { onConflict: 'external_id,region' });

  if (error) {
    console.error('[playlists] ❌ Failed to upsert playlists:', error.message);
  } else {
    console.log(`[playlists] ✅ ${unique.length} playlists synced to Supabase.`);
  }
}
