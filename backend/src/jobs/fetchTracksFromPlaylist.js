// ✅ FULL REWRITE v4.3 — Enhanced YouTube track fetcher (safe + complete)
// - Povećan broj stranica po playlisti (do 10 → 500 pesama)
// - Automatski preskače prazne i nepostojeće playliste
// - Ažurira `item_count` u tabeli playlists
// - Stabilno rotira API ključeve bez zagušenja

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, sleep } from '../lib/utils.js';

const MAX_API_CALLS_PER_DAY = 60000;
const MAX_PLAYLISTS_PER_RUN = 4000;
const MAX_PAGES_PER_PLAYLIST = 10; // ⬆️ povećano sa 3 → 10
const PAGE_SIZE = 50;

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);
if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

// ───────────────────────────────────────────────
// 🎵 Fetchuje sve pesme iz jedne playliste
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
      maxResults: PAGE_SIZE,
      pageToken,
    };

    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', { params });
      apiCallsToday++;

      if (!data.items?.length) break;

      const tracks = data.items.map(it => ({
        external_id: it.contentDetails?.videoId,
        title: it.snippet?.title ?? null,
        artist: it.snippet?.videoOwnerChannelTitle ?? null,
        cover_url: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
        source: 'youtube',
        sync_status: 'fetched',
        created_at: new Date().toISOString(),
      })).filter(t => t.external_id);

      all.push(...tracks);
      pageToken = data.nextPageToken || null;
      pages++;

      await sleep(120 + Math.random() * 80); // stabilna pauza
    } catch (e) {
      const msg = e.response?.data?.error?.message || e.message;
      if (msg.includes('playlistNotFound') || msg.includes('Invalid id')) {
        console.warn(`[tracks:${playlistId}] ⚠️ Playlist not found or private`);
        return []; // preskoči
      }
      console.error(`[tracks:${playlistId}]`, msg);
      break;
    }
  } while (pageToken && pages < MAX_PAGES_PER_PLAYLIST);

  const unique = Object.values(all.reduce((acc, t) => {
    if (!acc[t.external_id]) acc[t.external_id] = t;
    return acc;
  }, {}));
  return unique;
}

// ───────────────────────────────────────────────
// 🚀 Glavna funkcija — pokreće preuzimanje pesama
export async function runFetchTracks({ reason = 'daily-tracks' } = {}) {
  const sb = getSupabase();
  console.log(`[tracks] start (${reason})`);

  const today = new Date().toISOString().split('T')[0];
  const { data: playlists, error } = await sb
    .from('playlists')
    .select('id, external_id, title')
    .gte('fetched_on', `${today}T00:00:00Z`)
    .lt('fetched_on', `${today}T23:59:59Z`)
    .eq('is_public', true) // ⬅️ procesuiraj samo javne playliste
    .limit(MAX_PLAYLISTS_PER_RUN);

  if (error) throw error;
  console.log(`[tracks] ${playlists?.length || 0} playlists to process`);

  for (const pl of playlists || []) {
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) break;

    try {
      const tracks = await fetchTracksForPlaylist(pl.external_id);
      if (!tracks.length) {
        console.warn(`[tracks] ⚠️ Skipping empty playlist: ${pl.title}`);
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

      // 🧾 ažuriraj broj pesama u playlisti
      await sb.from('playlists')
        .update({ item_count: inserted.length })
        .eq('id', pl.id);

      console.log(`[tracks] ${pl.title}: +${inserted.length} tracks`);
      await sleep(150);
    } catch (e) {
      console.error(`[tracks] error for playlist ${pl.external_id}`, e.message);
    }
  }

  console.log(`[quota] ${apiCallsToday}/${MAX_API_CALLS_PER_DAY} used`);
  console.log('[tracks] done ✅');
}
