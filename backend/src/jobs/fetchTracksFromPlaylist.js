// ✅ FULL REWRITE — Optimized YouTube track fetcher (linked to playlist IDs)
import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, sleep } from '../lib/utils.js';

const MAX_API_CALLS_PER_DAY = 60000;
const MAX_PLAYLISTS_PER_RUN = 4000;   // ⬅️ povećano sa 10000 na realni dnevni limit
const MAX_PAGES_PER_PLAYLIST = 3;

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);
if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

async function fetchTracksForPlaylist(playlistId) {
  const all = [];
  let pageToken = null;
  let pages = 0;

  do {
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break;
    const key = nextKey();
    const params = {
      key,
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: 50,
      pageToken,
    };

    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', { params });
      apiCallsToday++;

      const tracks = (data.items || []).map(it => ({
        external_id: it.contentDetails?.videoId,
        title: it.snippet?.title ?? null,
        artist: it.snippet?.videoOwnerChannelTitle ?? null,
        cover_url: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
        source: 'youtube',
        sync_status: 'fetched',
        created_at: new Date().toISOString(),
      }));

      all.push(...tracks);
      pageToken = data.nextPageToken || null;
      pages++;
      await sleep(150 + Math.random() * 100);
    } catch (e) {
      console.error(`[tracks:${playlistId}]`, e.response?.data || e.message);
      break;
    }
  } while (pageToken && pages < MAX_PAGES_PER_PLAYLIST);

  const unique = Object.values(all.reduce((acc, t) => {
    if (!acc[t.external_id]) acc[t.external_id] = t;
    return acc;
  }, {}));
  return unique;
}

export async function runFetchTracks({ reason = 'daily-tracks' } = {}) {
  const sb = getSupabase();
  console.log(`[tracks] start (${reason})`);

  const today = new Date().toISOString().split('T')[0];
  const { data: playlists, error } = await sb
    .from('playlists')
    .select('id, external_id, title')
    .gte('fetched_on', `${today}T00:00:00Z`)
    .lt('fetched_on', `${today}T23:59:59Z`)
    .limit(MAX_PLAYLISTS_PER_RUN);

  if (error) throw error;
  console.log(`[tracks] ${playlists?.length || 0} playlists to process`);

  for (const pl of playlists || []) {
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break;
    try {
      const tracks = await fetchTracksForPlaylist(pl.external_id);
      if (!tracks.length) continue;

      const { data: inserted, error: err1 } = await sb
        .from('tracks')
        .upsert(tracks, { onConflict: 'external_id' })
        .select('id, external_id');
      if (err1) throw err1;

      const rels = inserted.map(t => ({
        playlist_id: pl.id,
        track_id: t.id,
        added_at: new Date().toISOString(),
      }));
      const { error: err2 } = await sb.from('playlist_tracks').upsert(rels, { onConflict: 'playlist_id,track_id' });
      if (err2) throw err2;

      console.log(`[tracks] ${pl.title}: +${inserted.length} tracks`);
      await sleep(150);
    } catch (e) {
      console.error(`[tracks] error for playlist ${pl.external_id}`, e.message);
    }
  }

  console.log(`[quota] ${apiCallsToday}/${MAX_API_CALLS_PER_DAY} used`);
  console.log('[tracks] done ✅');
}
