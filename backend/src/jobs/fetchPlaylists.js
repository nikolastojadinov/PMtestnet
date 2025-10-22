// ✅ FULL REWRITE — Safe fetch sa uklanjanjem duplikata pre upserta

import axios from 'axios';
import { upsertPlaylists } from '../lib/db.js';
import { pickTodayRegions, nextKeyFactory } from '../lib/utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const nextKey = nextKeyFactory(API_KEYS); // round-robin rotacija API ključeva

async function searchPlaylistsForRegion(regionCode, q = 'music playlist') {
  const key = nextKey();
  const url = 'https://www.googleapis.com/youtube/v3/search';
  const params = { key, part: 'snippet', maxResults: 25, type: 'playlist', q, regionCode };
  const { data } = await axios.get(url, { params });

  // 🔍 Formiraj rezultate i ukloni prazne ID-jeve
  const raw = (data.items || []).map(it => ({
    external_id: it.id?.playlistId,
    title: it.snippet?.title ?? null,
    description: it.snippet?.description ?? null,
    cover_url:
      it.snippet?.thumbnails?.high?.url ??
      it.snippet?.thumbnails?.default?.url ??
      null,
    region: regionCode,
    category: 'Music',
    is_public: true,
    fetched_on: new Date().toISOString(),
    channel_title: it.snippet?.channelTitle ?? null,
    language_guess: it.snippet?.defaultLanguage ?? null,
    quality_score: 0.5,
  })).filter(r => !!r.external_id);

  // 🧹 Filtriraj duplikate po external_id unutar batch-a
  const unique = Object.values(
    raw.reduce((acc, p) => {
      if (!acc[p.external_id]) acc[p.external_id] = p;
      return acc;
    }, {})
  );

  return unique;
}

export async function runFetchPlaylists({ reason = 'manual' } = {}) {
  if (API_KEYS.length < 1) throw new Error('YOUTUBE_API_KEYS missing.');
  const regions = pickTodayRegions(10); // 8–10 regiona dnevno
  console.log(`[fetch] start (${reason}) regions=${regions.join(',')}`);

  const batch = [];

  for (const r of regions) {
    try {
      const rows = await searchPlaylistsForRegion(r);
      console.log(`[fetch] ${r}: +${rows.length}`);
      batch.push(...rows);
      await new Promise(res => setTimeout(res, 300)); // kratka pauza između API poziva
    } catch (e) {
      console.error(`[fetch] ${r} error`, e.response?.data || e.message);
    }
  }

  if (batch.length) {
    // 💾 Siguran upsert kroz Supabase RPC funkciju (sprečava duplikate)
    const { count, error } = await upsertPlaylists(batch);
    if (error) throw error;
    console.log(`[fetch] upserted ${count} playlists`);
  } else {
    console.log('[fetch] nothing to upsert');
  }

  console.log('[fetch] done ✅');
}
