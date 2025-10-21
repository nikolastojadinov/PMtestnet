/**
 * Manual run (local):
 *   cd backend && cp .env.example .env && edit .env
 *   npm run jobs:fetch:once
 *   npm run jobs:refresh:once
 * Deployed (Render):
 *   BOOTSTRAP_FETCH=true triggers one-time fetch after first deploy.
 *   Cron schedule: fetch@09:05, refresh@21:05 (Europe/Budapest).
 */
import 'dotenv/config';
import axios from 'axios';
import { getSupabase } from '../lib/supabase.js';
import { initSupabase } from '../lib/supabase.js';

const API_KEYS = (process.env.YOUTUBE_API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
let keyIndex = 0;
function nextKey() {
  if (API_KEYS.length === 0) throw new Error('Missing YOUTUBE_API_KEYS');
  keyIndex = (keyIndex + 1) % API_KEYS.length;
  return API_KEYS[keyIndex];
}

async function pickYesterdayPlaylists(limit = 200) {
  const sb = getSupabase();
  const y = new Date(); y.setDate(y.getDate() - 1); y.setHours(0,0,0,0);
  const { data, error } = await sb
    .from('playlists')
    .select('external_id')
    .gte('fetched_on', y.toISOString())
    .lt('fetched_on', new Date(y.getTime() + 24*3600*1000).toISOString())
    .limit(limit);
  if (error) throw error;
  return data?.map(r => r.external_id) || [];
}

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
    cover_url: it.snippet?.thumbnails?.high?.url ?? it.snippet?.thumbnails?.default?.url ?? null,
    itemCount: it.contentDetails?.itemCount ?? null,
    last_refreshed_on: new Date().toISOString()
  };
}

export async function runRefreshPlaylists({ reason = 'manual' } = {}) {
  console.log(`[refresh] start (${reason})`);
  const sb = getSupabase();
  const ids = await pickYesterdayPlaylists(200);
  console.log(`[refresh] ${ids.length} playlists to refresh`);

  const updates = [];
  for (const id of ids) {
    try {
      const row = await fetchPlaylistSnippet(id);
      if (row) updates.push(row);
      await new Promise(res => setTimeout(res, 300));
    } catch (e) {
      console.error('[refresh] error for', id, e.response?.data || e.message);
    }
  }
  if (updates.length) {
    const rich = process.env.SUPABASE_RICH_SCHEMA === '1';
    const payload = updates.map(u => rich ? u : { external_id: u.external_id });
    const { error } = await sb.from('playlists').upsert(payload, { onConflict: 'external_id' });
    if (error) {
      // Fallback: no unique constraint on external_id
      if (error.code === '42P10' || /no unique|ON CONFLICT/i.test(error.message || '')) {
        let ok = 0;
        for (const u of updates) {
          try {
            const updatePayload = rich ? {
              title: u.title,
              description: u.description,
              cover_url: u.cover_url,
              itemCount: u.itemCount,
              last_refreshed_on: u.last_refreshed_on
            } : {};
            const { data: upd, error: updErr } = await sb
              .from('playlists')
              .update(updatePayload)
              .eq('external_id', u.external_id)
              .select('external_id');
            if (updErr) throw updErr;
            if (!upd || upd.length === 0) {
              const insertPayload = rich ? u : { external_id: u.external_id };
              const { error: insErr } = await sb.from('playlists').insert(insertPayload);
              if (insErr) throw insErr;
            }
            ok++;
          } catch (e) {
            console.error('[refresh] per-row update/insert failed:', e.message || e);
          }
        }
        console.log(`[refresh] upserted/updated ${ok}`);
      } else {
        throw error;
      }
    } else {
      console.log('[refresh] upserted', payload.length);
    }
  } else {
    console.log('[refresh] nothing to update');
  }
  console.log('[refresh] done');
}

// CLI: node src/jobs/refreshPlaylists.js --once
if (process.argv.includes('--once')) {
  (async () => {
    await initSupabase();
    await runRefreshPlaylists({ reason: 'cli-once' });
  })().then(() => process.exit(0)).catch(err => {
    console.error(err); process.exit(1);
  });
}
