// ✅ FULL REWRITE — Stabilan dnevni REFRESH za pesme u plejlistama (od 31. dana ciklusa nadalje)

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { dateWindowForCycleDay, nextKeyFactory, sleep } from '../lib/utils.js';

const MAX_PAGES_PER_PLAYLIST = 3;
const MAX_API_CALLS_PER_DAY = 60000;

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');
const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

/**
 * 🎵 Preuzima sve pesme iz postojeće YouTube plejliste
 */
async function fetchPlaylistTracks(playlistId) {
  const collected = [];
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
      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/playlistItems',
        { params }
      );
      apiCallsToday++;

      const tracks = (data.items || []).map(it => ({
        external_id: it.contentDetails?.videoId,
        title: it.snippet?.title ?? null,
        artist: it.snippet?.videoOwnerChannelTitle ?? null,
        cover_url:
          it.snippet?.thumbnails?.high?.url ??
          it.snippet?.thumbnails?.default?.url ??
          null,
        source: 'youtube',
        sync_status: 'fetched',
        created_at: new Date().toISOString(),
      }));

      collected.push(...tracks);
      pageToken = data.nextPageToken || null;
      pages++;
      await sleep(200);
    } catch (e) {
      console.error(`[refreshTracks:${playlistId}]`, e.response?.data || e.message);
      break;
    }
  } while (pageToken && pages < MAX_PAGES_PER_PLAYLIST);

  // 🧹 Ukloni duplikate po external_id
  const unique = Object.values(
    collected.reduce((acc, t) => {
      if (!acc[t.external_id]) acc[t.external_id] = t;
      return acc;
    }, {})
  );

  return unique;
}

/**
 * 🔄 Glavna funkcija — REFRESH pesama za plejliste preuzete određenog dana ciklusa
 */
export async function runRefreshTracks({ reason = 'manual', targetDay }) {
  if (!targetDay || targetDay < 1 || targetDay > 29) {
    throw new Error('refresh targetDay must be 1..29');
  }

  const sb = getSupabase();
  const { from, to } = dateWindowForCycleDay(targetDay);
  console.log(`[refreshTracks] start (${reason}) targetDay=${targetDay} window=[${from}..${to})`);

  // 🔍 Izvuci sve plejliste fetch-ovane tog dana
  const { data: playlists, error } = await sb
    .from('playlists')
    .select('id, external_id, title')
    .gte('fetched_on', from)
    .lt('fetched_on', to)
    .limit(1000);

  if (error) throw error;
  console.log(`[refreshTracks] ${playlists?.length || 0} playlists to refresh`);

  for (const pl of playlists || []) {
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break;

    try {
      const tracks = await fetchPlaylistTracks(pl.external_id);
      if (!tracks.length) continue;

      // 1️⃣ Upsert pesama u "tracks" tabelu
      const { data: inserted, error: err1 } = await sb
        .from('tracks')
        .upsert(tracks, { onConflict: 'external_id' })
        .select('id, external_id');
      if (err1) throw err1;

      // 2️⃣ Poveži ih u "playlist_tracks"
      const rels = inserted.map(t => ({
        playlist_id: pl.id,
        track_id: t.id,
        added_at: new Date().toISOString(),
      }));
      const { error: err2 } = await sb
        .from('playlist_tracks')
        .upsert(rels, { onConflict: 'playlist_id,track_id' });
      if (err2) throw err2;

      // 3️⃣ Ažuriraj `last_refreshed_on` u tabeli playlists
      await sb
        .from('playlists')
        .update({ last_refreshed_on: new Date().toISOString() })
        .eq('id', pl.id);

      console.log(`[refreshTracks] ${pl.title}: +${inserted.length} tracks`);
      await sleep(200);
    } catch (e) {
      console.error(`[refreshTracks] error for playlist ${pl.external_id}`, e.message);
    }
  }

  console.log(`[quota] ${apiCallsToday}/${MAX_API_CALLS_PER_DAY} used`);
  console.log('[refreshTracks] done ✅');
}
