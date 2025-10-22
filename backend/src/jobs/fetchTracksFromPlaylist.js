// ✅ FULL REWRITE — Preuzimanje pesama iz plejlista preuzetih danas

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { sleep, nextKeyFactory } from '../lib/utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (API_KEYS.length < 1) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);

async function fetchTracksForPlaylist(playlistId) {
  const key = nextKey();
  const url = 'https://www.googleapis.com/youtube/v3/playlistItems';
  const params = {
    key,
    part: 'snippet,contentDetails',
    maxResults: 50,
    playlistId,
  };

  const all = [];
  let nextPageToken = null;
  let pages = 0;

  do {
    const { data } = await axios.get(url, { params: { ...params, pageToken: nextPageToken } });
    const items = (data.items || []).map(it => ({
      source: 'youtube',
      external_id: it.contentDetails?.videoId ?? null,
      title: it.snippet?.title ?? null,
      artist: it.snippet?.videoOwnerChannelTitle ?? null,
      duration: null, // može se popuniti kasnije
      cover_url: it.snippet?.thumbnails?.high?.url ?? null,
      created_at: new Date().toISOString(),
      sync_status: 'new',
    })).filter(t => !!t.external_id);

    all.push(...items);
    nextPageToken = data.nextPageToken || null;
    pages++;
    await sleep(200);
  } while (nextPageToken && pages < 5);

  return all;
}

export async function runFetchTracks({ reason = 'manual' } = {}) {
  const sb = getSupabase();
  const { data: playlists, error } = await sb
    .from('playlists')
    .select('external_id')
    .gte('fetched_on', new Date().toISOString().slice(0, 10));

  if (error) throw error;
  if (!playlists?.length) {
    console.log('[tracks] no new playlists for today');
    return;
  }

  console.log(`[tracks] start (${reason}) for ${playlists.length} playlists`);

  for (const p of playlists) {
    try {
      const tracks = await fetchTracksForPlaylist(p.external_id);
      if (!tracks.length) continue;

      // upsert pesama
      const { error: err1 } = await sb.from('tracks').upsert(tracks, { onConflict: 'external_id' });
      if (err1) throw err1;

      // poveži ih sa playlistom
      const links = tracks.map(t => ({
        playlist_id: p.external_id,
        track_id: t.external_id,
        added_at: new Date().toISOString(),
      }));
      const { error: err2 } = await sb.from('playlist_tracks').upsert(links, { onConflict: 'playlist_id,track_id' });
      if (err2) throw err2;

      console.log(`[tracks] ${p.external_id}: +${tracks.length} tracks`);
      await sleep(500);
    } catch (e) {
      console.error(`[tracks:${p.external_id}]`, e.response?.data || e.message);
    }
  }

  console.log('[tracks] done ✅');
}
