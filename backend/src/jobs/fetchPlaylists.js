// ✅ FULL REWRITE — Fetch REAL music playlists via Search API (type=playlist, topicId=Music)
import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, pickTodayRegions, sleep } from '../lib/utils.js';

const MAX_PLAYLISTS_PER_RUN = 3000;   // cilj dnevno
const REGIONS_PER_DAY = 10;           // koliko regiona dnevno
const MAX_PAGES_PER_REGION = 40;      // 40×50 = do 2000 rezultata po regionu

// 🔐 API ključevi (isti env format kao do sada, više ključeva razdvojeno zarezom)
const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);
if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);

export async function runFetchPlaylists({ reason = 'daily-playlists' } = {}) {
  const sb = getSupabase();
  console.log(`[playlists] start (${reason})`);

  const regions = pickTodayRegions(REGIONS_PER_DAY);
  const collected = [];
  let apiCalls = 0;

  for (const region of regions) {
    console.log(`[playlists] region: ${region}`);
    let pageToken = null;
    let pages = 0;

    do {
      if (collected.length >= MAX_PLAYLISTS_PER_RUN) break;

      const key = nextKey();
      const params = {
        key,
        part: 'snippet',
        type: 'playlist',
        topicId: '/m/04rlf',      // Music topic
        regionCode: region,
        maxResults: 50,
        pageToken
      };

      try {
        const { data } = await axios.get(
          'https://www.googleapis.com/youtube/v3/search',
          { params }
        );
        apiCalls++;

        const batch = (data.items || [])
          .map(it => {
            const sn = it.snippet || {};
            const thumbs = sn.thumbnails || {};
            const cover =
              thumbs.high?.url ||
              thumbs.medium?.url ||
              thumbs.default?.url ||
              null;

            return {
              external_id: it.id?.playlistId ?? null,
              title: sn.title ?? null,
              description: sn.description ?? null,
              cover_url: cover,
              region,
              category: 'music',
              is_public: true,
              fetched_on: new Date().toISOString(),
              created_at: new Date().toISOString(),
              sync_status: 'fetched',
            };
          })
          .filter(row => row.external_id); // safety

        collected.push(...batch);
        console.log(`[playlists] ${region}: +${batch.length} (page ${pages + 1})`);

        pageToken = data.nextPageToken || null;
        pages++;
        await sleep(120 + Math.random() * 120);
      } catch (e) {
        console.error(`[playlists:${region}]`, e.response?.data || e.message);
        // pređi na sledeći region kad kvota/greška „pukne”
        await sleep(400);
        break;
      }
    } while (pageToken && pages < MAX_PAGES_PER_REGION && collected.length < MAX_PLAYLISTS_PER_RUN);
  }

  // 🧹 dedupe po external_id
  const unique = Object.values(
    collected.reduce((acc, p) => {
      if (p.external_id && !acc[p.external_id]) acc[p.external_id] = p;
      return acc;
    }, {})
  );

  // 💾 upsert u Supabase
  const { error } = await sb.from('playlists').upsert(unique, { onConflict: 'external_id' });
  if (error) console.error('[playlists] upsert error:', error);

  console.log(`[playlists] done ✅ total: ${unique.length} playlists, API calls: ${apiCalls}`);
}
