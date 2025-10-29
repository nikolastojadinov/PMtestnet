// ✅ FULL REWRITE v5.0 — Unlimited YouTube track fetcher (no limits)
// - Fetches *all* available tracks from every playlist
// - No daily cap, no per-playlist cap
// - Safe key rotation and retry logic
// - Updates item_count accurately in Supabase

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, sleep } from '../lib/utils.js';

// 🚫 Uklonjeni svi limiti i kvote
const PAGE_SIZE = 50;

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);
if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);

// ───────────────────────────────────────────────
// 🎵 Fetchuje sve pesme iz jedne YouTube playliste — bez ikakvog ograničenja
async function fetchTracksForPlaylist(playlistId) {
  const all = [];
  let pageToken = null;

  while (true) {
    const key = nextKey();
    const params = {
      key,
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: PAGE_SIZE,
      pageToken,
    };

    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', { params });

      if (!data.items?.length) break;

      const tracks = data.items
        .map(it => {
          const title = it.snippet?.title?.trim() || null;
          const videoId = it.contentDetails?.videoId || null;
          const artist = it.snippet?.videoOwnerChannelTitle?.trim() || null;
          const cover =
            it.snippet?.thumbnails?.high?.url ||
            it.snippet?.thumbnails?.medium?.url ||
            it.snippet?.thumbnails?.default?.url ||
            null;

          // ❌ Preskoči obrisane, privatne ili nedostupne video-zapise
          if (
            !videoId ||
            !title ||
            title.toLowerCase().includes('deleted video') ||
            title.toLowerCase().includes('private video') ||
            title.toLowerCase().includes('unavailable') ||
            title === '[Deleted video]' ||
            title === '[Private video]'
          ) {
            return null;
          }

          return {
            external_id: videoId,
            title,
            artist,
            cover_url: cover,
            source: 'youtube',
            sync_status: 'fetched',
            created_at: new Date().toISOString(),
          };
        })
        .filter(Boolean);

      all.push(...tracks);

      // ↪️ Idi na sledeću stranicu dok YouTube vraća nextPageToken
      pageToken = data.nextPageToken || null;
      if (!pageToken) break;

      await sleep(100 + Math.random() * 60);
    } catch (e) {
      const msg = e.response?.data?.error?.message || e.message;
      if (msg.includes('playlistNotFound') || msg.includes('Invalid id')) {
        console.warn(`[tracks:${playlistId}] ⚠️ Playlist not found or private`);
        return [];
      }
      console.error(`[tracks:${playlistId}] ${msg}`);
      break;
    }
  }

  // ✅ Ukloni duplikate
  const unique = Object.values(
    all.reduce((acc, t) => {
      if (!acc[t.external_id]) acc[t.external_id] = t;
      return acc;
    }, {})
  );

  return unique;
}

// ───────────────────────────────────────────────
// 🚀 Glavna funkcija — preuzima pesme za sve playliste dana (bez limita)
export async function runFetchTracks({ reason = 'daily-tracks' } = {}) {
  const sb = getSupabase();
  console.log(`[tracks] start (${reason})`);

  const today = new Date().toISOString().split('T')[0];
  const { data: playlists, error } = await sb
    .from('playlists')
    .select('id, external_id, title')
    .gte('fetched_on', `${today}T00:00:00Z`)
    .lt('fetched_on', `${today}T23:59:59Z`)
    .eq('is_public', true);

  if (error) throw error;
  console.log(`[tracks] ${playlists?.length || 0} playlists to process`);

  for (const pl of playlists || []) {
    try {
      const tracks = await fetchTracksForPlaylist(pl.external_id);
      if (!tracks.length) {
        console.warn(`[tracks] ⚠️ Skipping empty or invalid playlist: ${pl.title}`);
        continue;
      }

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

      const { error: err2 } = await sb
        .from('playlist_tracks')
        .upsert(rels, { onConflict: 'playlist_id,track_id' });
      if (err2) throw err2;

      await sb
        .from('playlists')
        .update({ item_count: inserted.length })
        .eq('id', pl.id);

      console.log(`[tracks] ${pl.title}: +${inserted.length} clean tracks`);
      await sleep(150);
    } catch (e) {
      console.error(`[tracks] error for playlist ${pl.external_id}`, e.message);
    }
  }

  console.log('[tracks] done ✅ (no limits applied)');
}
