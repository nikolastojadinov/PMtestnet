// FULL REWRITE — dnevni refresh u 09:05; targetDay = 1..29

import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { dateWindowForCycleDay, nextKeyFactory } from '../lib/utils.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const nextKey = nextKeyFactory(API_KEYS);

async function fetchPlaylistSnippet(playlistId) {
  const key = nextKey();
  const url = 'https://www.googleapis.com/youtube/v3/playlists';
  const params = { key, part: 'snippet,contentDetails', id: playlistId, maxResults: 1 };
  const { data } = await axios.get(url, { params });
  const it = data.items?.[0];
  if (!it) return null;
  return {
    external_id: playlistId,
    title: it.snippet?.title ?? null,
    description: it.snippet?.description ?? null,
    cover_url: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
    itemCount: it.contentDetails?.itemCount ?? null,
    last_refreshed_on: new Date().toISOString()
  };
}

export async function runRefreshPlaylists({ reason = 'manual', targetDay }) {
  if (!targetDay || targetDay < 1 || targetDay > 29) throw new Error('refresh targetDay must be 1..29');
  if (API_KEYS.length < 1) throw new Error('YOUTUBE_API_KEYS missing.');

  const sb = getSupabase();
  const { from, to } = dateWindowForCycleDay(targetDay); // ISO opseg za fetched_on
  console.log(`[refresh] start (${reason}) targetDay=${targetDay} window=[${from}..${to})`);

  const { data: ids, error } = await sb
    .from('playlists')
    .select('external_id')
    .gte('fetched_on', from)
    .lt('fetched_on', to)
    .limit(500);
  if (error) throw error;

  console.log(`[refresh] ${ids?.length || 0} playlists to refresh`);
  const updates = [];
  for (const row of (ids || [])) {
    try {
      const upd = await fetchPlaylistSnippet(row.external_id);
      if (upd) updates.push(upd);
      await new Promise(res => setTimeout(res, 200));
    } catch (e) {
      console.error('[refresh] error for', row.external_id, e.response?.data || e.message);
    }
  }

  if (updates.length) {
    const { error: upErr } = await sb.from('playlists').upsert(updates, { onConflict: 'external_id' });
    if (upErr) throw upErr;
    console.log(`[refresh] upserted ${updates.length}`);
  } else {
    console.log('[refresh] nothing to update');
  }
  console.log('[refresh] done');
}
