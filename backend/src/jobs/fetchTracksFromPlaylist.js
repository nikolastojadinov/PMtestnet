// ✅ FULL REWRITE — Stable YouTube track fetcher with quota guard (50% daily usage)

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, sleep } from '../lib/utils.js';

// 🔧 Konfiguracija kvote
const MAX_API_CALLS_PER_DAY = 30000; // koristi 50% od ukupne kvote (6×10k)
const MAX_PAGES_PER_PLAYLIST = 3; // do 150 pesama po playlisti (3×50)
const MAX_PLAYLISTS_PER_RUN = 60; // dnevno obradi max 60 playlisti

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

// 🎵 Fetch pesama iz jedne YouTube playliste
async function fetchTracksForPlaylist(playlistId) {
  const all = [];
  let pageToken = null;
  let pages = 0;

  do {
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) {
      console.warn(`[quota-guard] Track fetch limit reached (${apiCallsToday})`);
      break;
    }

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
      apiCallsToday++;

      const items = (data.items || []).map(it => ({
        external_id: it.contentDetails?.videoId,
        title: it.snippet?.title ?? null,
        artist: it.snippet?.videoOwnerChannelTitle ?? null,
        duration: null, // YouTube ne vraća trajanje ovde
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
        console.warn('[quota] switching API key...');
        continue;
      } else {
        console.error(`[tracks:${playlistId}]`, e.response?.data || e.message);
        break;
      }
    }
  } while (pageToken && pages < MAX_PAGES_PER_PLAYLIST);

  // 🧹 Ukloni duplikate
  const unique = Object.values(
    all.reduce((acc, t) => {
      if (!acc[t.external_id]) acc[t.external_id] = t;
      return acc;
    }, {})
  );

  return unique;
}

// 🚀 Glavna funkcija
export async function runFetchTracks({ reason = 'manual' } = {}) {
  const sb = getSupabase();
  console.log(`[tracks] start (${reason})`);

  // 🎯 Uzmi samo plejlistе koje su fetch-ovane danas
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
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) {
      console.warn(`[quota-guard] Daily track limit reached (${apiCallsToday}). Ending early.`);
      break;
    }

    try {
      const tracks = await fetchTracksForPlaylist(pl.external_id);
      if (!tracks.length) continue;

      // 💾 Upsert u `tracks`
      const { data: inserted, error: err1 } = await sb
        .from('tracks')
        .upsert(tracks, { onConflict: 'external_id' })
        .select('id, external_id');

      if (err1) throw err1;

      // 🔗 Upsert u `playlist_tracks`
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

  console.log(`[tracks] done ✅ total API calls: ${apiCallsToday}`);
}
