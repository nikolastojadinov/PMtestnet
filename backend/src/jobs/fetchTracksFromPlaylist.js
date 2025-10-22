// ✅ FULL REWRITE — Fetch tracks for all playlists from today
// Preuzima do 50 pesama po plejlisti i upisuje u Supabase

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, sleep, todayLocalISO } from '../lib/utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (API_KEYS.length < 1) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS); // rotacija ključeva

async function fetchTracksForPlaylist(playlistId) {
  const key = nextKey();
  const url = 'https://www.googleapis.com/youtube/v3/playlistItems';
  const params = {
    key,
    part: 'snippet,contentDetails',
    maxResults: 50,
    playlistId,
  };

  try {
    const { data } = await axios.get(url, { params });
    const items = (data.items || []).map(it => ({
      source: 'youtube',
      external_id: it.contentDetails?.videoId,
      title: it.snippet?.title ?? null,
      artist: it.snippet?.videoOwnerChannelTitle ?? null,
      duration: null, // trajanje može kasnije dodati preko videos.list
      cover_url:
        it.snippet?.thumbnails?.high?.url ??
        it.snippet?.thumbnails?.default?.url ??
        null,
      created_at: new Date().toISOString(),
      sync_status: 'fetched',
      playlist_id: playlistId,
    })).filter(t => !!t.external_id);

    return items;
  } catch (e) {
    if (e.response?.status === 403 && e.response?.data?.error?.message?.includes('quota')) {
      console.warn(`[quota] key exhausted, rotating...`);
      return []; // preskoči na sledeći ključ
    }
    console.error(`[tracks:${playlistId}]`, e.response?.data || e.message);
    return [];
  }
}

export async function runFetchTracks({ reason = 'manual' } = {}) {
  const sb = getSupabase();
  const today = todayLocalISO(new Date());

  console.log(`[tracks] start (${reason}) for playlists fetched_on=${today}`);

  // 🎧 Uzmi plejlist ID-jeve koje su preuzete danas
  const { data: playlists, error: listErr } = await sb
    .from('playlists')
    .select('external_id')
    .gte('fetched_on', today);

  if (listErr) throw listErr;
  if (!playlists?.length) {
    console.log('[tracks] no playlists found for today');
    return;
  }

  const allTracks = [];
  for (const p of playlists) {
    const playlistId = p.external_id;
    const tracks = await fetchTracksForPlaylist(playlistId);
    console.log(`[tracks] ${playlistId}: +${tracks.length}`);
    allTracks.push(...tracks);
    await sleep(400);
  }

  if (allTracks.length) {
    // 🧹 Ukloni duplikate pesama po videoId
    const uniqueTracks = Object.values(
      allTracks.reduce((acc, t) => {
        acc[t.external_id] = t;
        return acc;
      }, {})
    );

    // 🔽 Razdvoj tabele
    const tracksTable = uniqueTracks.map(t => ({
      source: t.source,
      external_id: t.external_id,
      title: t.title,
      artist: t.artist,
      duration: t.duration,
      cover_url: t.cover_url,
      created_at: t.created_at,
      sync_status: t.sync_status,
    }));

    const playlistTracksTable = uniqueTracks.map(t => ({
      playlist_id: t.playlist_id,
      track_id: t.external_id,
      added_at: new Date().toISOString(),
    }));

    console.log(`[tracks] inserting ${tracksTable.length} unique tracks`);

    // 💾 Upsert u tabele
    const { error: tErr } = await sb.from('tracks').upsert(tracksTable, { onConflict: 'external_id' });
    if (tErr) throw tErr;

    const { error: ptErr } = await sb.from('playlist_tracks').upsert(playlistTracksTable, { onConflict: 'playlist_id,track_id' });
    if (ptErr) throw ptErr;

    console.log(`[tracks] upserted ${tracksTable.length} tracks and ${playlistTracksTable.length} relations`);
  } else {
    console.log('[tracks] nothing to upsert');
  }

  console.log('[tracks] done ✅');
}
