// ✅ FULL REWRITE — Stabilan dnevni REFRESH (od 31. dana ciklusa nadalje)

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { dateWindowForCycleDay, nextKeyFactory, sleep } from '../lib/utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const nextKey = nextKeyFactory(API_KEYS); // round-robin rotacija API ključeva

/**
 * 🔄 Preuzmi ažurirane metapodatke o postojećoj YouTube plejlisti
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
 * 🧠 Glavna funkcija: REFRESH plejlista preuzetih određenog dana ciklusa (1–29)
 */
export async function runRefreshPlaylists({ reason = 'manual', targetDay }) {
  if (!targetDay || targetDay < 1 || targetDay > 29) {
    throw new Error('refresh targetDay must be 1..29');
  }
  if (API_KEYS.length < 1) {
    throw new Error('YOUTUBE_API_KEYS missing.');
  }

  const sb = getSupabase();
  const { from, to } = dateWindowForCycleDay(targetDay); // ISO prozor za fetched_on
  console.log(`[refresh] start (${reason}) targetDay=${targetDay} window=[${from}..${to})`);

  // 🔍 Uzmi sve plejliste koje su fetch-ovane u tom danu
  const { data: ids, error } = await sb
    .from('playlists')
    .select('external_id')
    .gte('fetched_on', from)
    .lt('fetched_on', to)
    .limit(1000); // do 1000 plejlista dnevno u refresh fazi

  if (error) throw error;
  console.log(`[refresh] ${ids?.length || 0} playlists to refresh`);

  const updates = [];

  for (const row of ids || []) {
    try {
      const upd = await fetchPlaylistSnippet(row.external_id);
      if (upd) updates.push(upd);
      await sleep(250); // mala pauza između zahteva
    } catch (e) {
      console.error('[refresh] error for', row.external_id, e.response?.data || e.message);
    }
  }

  // 💾 Upsert (sigurno ažuriranje postojećih redova)
  if (updates.length) {
    const { error: upErr } = await sb
      .from('playlists')
      .upsert(updates, { onConflict: 'external_id' });

    if (upErr) throw upErr;
    console.log(`[refresh] upserted ${updates.length} playlists`);
  } else {
    console.log('[refresh] nothing to update');
  }

  console.log('[refresh] done ✅');
}
