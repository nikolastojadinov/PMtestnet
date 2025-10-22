// ✅ FULL REWRITE — Fetch tracks for all playlists fetched today
// Preuzima do 50 pesama po plejlisti i upisuje ih u `tracks` + `playlist_tracks`

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, dateWindowForCycleDay, sleep } from '../lib/utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);

async function fetchTracksForPlaylist(playlistId) {
  const all = [];
  let pageToken = null;
  let pages = 0;

  do {
    const key = nextKey();
    const url = 'https://www.googleapis.com/youtube/v3/playlistItems';
    const params = {
      key,
      part: 'snippet,contentDetails',
      maxResults: 50,
      playlistId,
      pageToken,
    };

    try {
      const { data } = await axios.get(url, { params });
      const items = (data.items || []).map(it => ({
        external_id: it.contentDetails?.videoId,
        title: it.snippet?.title ?? null,
        artist: it.snippet?.videoOwnerChannelTitle ?? null,
        duration: null, // nema duration u ovom endpointu
        cover_url:
          it.snippet?.thumbnails?.high?.url ??
          it.snippet?.thumbnails?.default?.url ??
          null,
        source: 'youtube',
        created_at: new Date().toISOString(),
        sync_status: 'fetched',
      }));

      all.push(...items);
      pageToken = data.nextPageToken || null;
      pages++;
      await sleep(300);

    } catch (e) {
      if (e.response?.status === 403 && e.response?.data?.error?.message?.includes('quota')) {
        console.warn('[quota] switching key...');
        continue;
      } else {
        console.error('[track-fetch]', e.response?.data || e.message);
        break;
      }
    }
  } while (pageToken && pages < 3);

  // 🧹 Ukloni duplikate
  const unique = Object.values(
    all.reduce((acc, t) => {
      if (!acc[t.external_id]) acc[t.external_id] = t;
      return acc;
    }, {})
  );

  return unique;
}

export async function runFetchTracks({ reason = 'manual' } = {}) {
  const sb = getSupabase();
  console.log(`[tracks] start (${reason})`);

  // Preuzmi sve plejliste iz danasnjeg fetch-a
  const today = new Date().toISOString().split('T')[0];
  const { data: playlists, error } = await sb
    .from('playlists')
    .select('id, external_id, title')
    .gte('fetched_on', `${today}T00:00:00Z`)
    .lt('fetched_on', `${today}T23:59:59Z`)
    .limit(50);

  if (error) throw error;
  console.log(`[tracks] ${playlists?.length || 0} playlists to process`);

  for (const pl of playlists) {
    try {
      const tracks = await fetchTracksForPlaylist(pl.external_id);
      if (!tracks.length) continue;

      // upsert pesme u `tracks`
      const { data: inserted, error: err1 } = await sb
        .from('tracks')
        .upsert(tracks, { onConflict: 'external_id' })
        .select('id, external_id');

      if (err1) throw err1;

      // poveži pesme sa playlistom
      const rels = inserted.map(t => ({
        playlist_id: pl.id,
        track_id: t.id,
        added_at: new Date().toISOString(),
      }));

      const { error: err2 } = await sb
        .from('playlist_tracks')
        .upsert(rels, { onConflict: 'playlist_id,track_id' });

      if (err2) throw err2;

      console.log(`[tracks] ${pl.title}: +${inserted.length} tracks`);
      await sleep(500);
    } catch (e) {
      console.error(`[tracks] error for playlist ${pl.external_id}`, e.message);
    }
  }

  console.log('[tracks] done ✅');
}
