// ✅ FULL REWRITE — Stabilan dnevni REFRESH plejlista + pesama
// Aktivira se od 30. dana ciklusa nadalje i osvežava dan 1–29 u beskonačnoj petlji

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { dateWindowForCycleDay, nextKeyFactory, sleep } from '../lib/utils.js';
import { runRefreshTracks } from './refreshTracksFromPlaylist.js'; // 🔗 auto refresh pesama

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (!API_KEYS.length) throw new Error('YOUTUBE_API_KEYS missing.');

const nextKey = nextKeyFactory(API_KEYS);

/**
 * 🔄 Preuzmi ažurirane metapodatke o YouTube plejlisti
 */
async function fetchPlaylistSnippet(playlistId) {
  const key = nextKey();
  const url = 'https://www.googleapis.com/youtube/v3/playlists';
  const params = {
    key,
    part: 'snippet,contentDetails',
    id: playlistId,
    maxResults: 1
  };

  const { data } = await axios.get(url, { params });
  const it = data.items?.[0];
  if (!it) return null;

  return {
    external_id: playlistId,
    title: it.snippet?.title ?? null,
    description: it.snippet?.description ?? null,
    cover_url:
      it.snippet?.thumbnails?.high?.url ??
      it.snippet?.thumbnails?.default?.url ??
      null,
    itemCount: it.contentDetails?.itemCount ?? null,
    last_refreshed_on: new Date().toISOString(),
    channel_title: it.snippet?.channelTitle ?? null,
    language_guess: it.snippet?.defaultLanguage ?? null
  };
}

/**
 * 🧠 REFRESH plejlista preuzetih određenog dana ciklusa (1–29)
 * Od 30. dana pa nadalje radi u beskonačnoj 29-dnevnoj rotaciji.
 */
export async function runRefreshPlaylists({ reason = 'manual', currentDay }) {
  if (!currentDay || currentDay < 30) {
    throw new Error('refresh phase počinje od 30. dana ciklusa.');
  }

  // 🧮 Izračunaj koji FETCH dan treba da se refrešuje (1–29)
  const targetDay = ((currentDay - 30) % 29) + 1;
  const sb = getSupabase();
  const { from, to } = dateWindowForCycleDay(targetDay);

  console.log(
    `[refresh] start (${reason}) currentDay=${currentDay} → targetDay=${targetDay} window=[${from}..${to})`
  );

  const { data: ids, error } = await sb
    .from('playlists')
    .select('external_id')
    .gte('fetched_on', from)
    .lt('fetched_on', to)
    .limit(1000);

  if (error) throw error;
  console.log(`[refresh] ${ids?.length || 0} playlists to refresh`);

  const updates = [];
  for (const row of ids || []) {
    try {
      const upd = await fetchPlaylistSnippet(row.external_id);
      if (upd) updates.push(upd);
      await sleep(250);
    } catch (e) {
      console.error('[refresh] error for', row.external_id, e.response?.data || e.message);
    }
  }

  if (updates.length) {
    const { error: upErr } = await sb
      .from('playlists')
      .upsert(updates, { onConflict: 'external_id' });
    if (upErr) throw upErr;
    console.log(`[refresh] upserted ${updates.length} playlists`);
  } else {
    console.log('[refresh] nothing to update');
  }

  console.log('[refresh] playlist metadata refresh done ✅');

  // 🎵 automatski refresh pesama
  try {
    console.log(`[refresh] launching track refresh for targetDay=${targetDay}...`);
    await runRefreshTracks({ reason: 'auto-chain', targetDay });
    console.log('[refresh] playlist + tracks refresh done ✅');
  } catch (trackErr) {
    console.error('[refresh] track refresh error:', trackErr.message);
  }

  console.log('[refresh] done ✅');
}
