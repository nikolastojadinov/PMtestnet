// ✅ FULL REWRITE — Stable YouTube track fetcher with quota guard (50% daily usage)
// - koristi 6 API ključeva × 10k QUs (60k ukupno)
// - koristi max 30.000 API poziva (50% ukupne dnevne kvote)
// - automatski loguje rezultate u Supabase tabelu fetch_runs (job_type = 'tracks')
// - sigurno upisuje sync_status (sprečava "tracks_sync_status_check" greške)

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { nextKeyFactory, sleep } from '../lib/utils.js';

// 🔧 KONFIGURACIJA KVOTE
const MAX_API_CALLS_PER_DAY = 30000; // koristi 50% od ukupne kvote (6×10k)
const MAX_PAGES_PER_PLAYLIST = 3; // do 150 pesama po playlisti (3×50)
const MAX_PLAYLISTS_PER_RUN = 60; // dnevno obradi max 60 playlisti

// 🔐 API ključevi
const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);
let apiCallsToday = 0;

// 🎵 Preuzimanje pesama iz jedne YouTube playliste
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
        duration: null,
        cover_url:
          it.snippet?.thumbnails?.high?.url ??
          it.snippet?.thumbnails?.default?.url ??
          null,
        source: 'youtube',
        created_at: new Date().toISOString(),
        sync_status: 'FETCHED', // ✅ uppercase, validna vrednost
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

  // 🎯 Uzmi samo plejliste fetch-ovane danas
  const today = new Date().toISOString().split('T')[0];
  const { data: playlists, error } = await sb
    .from('playlists')
    .select('id, external_id, title')
    .gte('fetched_on', `${today}T00:00:00Z`)
    .lt('fetched_on', `${today}T23:59:59Z`)
    .limit(MAX_PLAYLISTS_PER_RUN);

  if (error) throw error;
  console.log(`[tracks] ${playlists?.length || 0} playlists to process`);

  const startedAt = new Date().toISOString();
  let totalInserted = 0;
  const processedPlaylists = [];

  // ✅ Dozvoljene vrednosti sync_status kolone
  const allowedStatuses = ['NEW', 'FETCHED', 'REFRESHED', 'FAILED', 'local'];

  for (const pl of playlists || []) {
    if (apiCallsToday >= MAX_API_CALLS_PER_DAY) {
      console.warn(`[quota-guard] Daily track limit reached (${apiCallsToday}). Ending early.`);
      break;
    }

    try {
      const tracks = await fetchTracksForPlaylist(pl.external_id);
      if (!tracks.length) continue;

      // 🛡️ Osiguraj validan sync_status
      const cleanedTracks = tracks.map(t => ({
        ...t,
        sync_status: allowedStatuses.includes(t.sync_status)
          ? t.sync_status
          : 'FETCHED',
      }));

      // 💾 Upsert u `tracks`
      const { data: inserted, error: err1 } = await sb
        .from('tracks')
        .upsert(cleanedTracks, { onConflict: 'external_id' })
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

      totalInserted += inserted.length;
      processedPlaylists.push({ id: pl.id, title: pl.title, count: inserted.length });

      console.log(`[tracks] ${pl.title}: +${inserted.length} tracks`);
      await sleep(500);
    } catch (e) {
      console.error(`[tracks] error for playlist ${pl.external_id}`, e.message);
    }
  }

  const finishedAt = new Date().toISOString();

  // 🧾 Loguj rezultat u fetch_runs
  try {
    const { error: logErr } = await sb
      .from('fetch_runs')
      .insert({
        started_at: startedAt,
        finished_at: finishedAt,
        regions: JSON.stringify(processedPlaylists),
        playlists_count: playlists?.length || 0,
        api_calls: apiCallsToday,
        quota_used: apiCallsToday * 100,
        job_type: 'tracks',
        success: true,
      });

    if (logErr) throw logErr;
    console.log(`[tracks_log] ✅ recorded fetch run (${totalInserted} tracks total)`);
  } catch (e) {
    console.error('[tracks_log] ❌ failed to record fetch_runs:');
    console.error(e);
  }

  console.log(`[tracks] done ✅ total API calls: ${apiCallsToday}`);
}
