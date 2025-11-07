// Fetch tracks task: process prepared warm-up targets in 5×200 batches
// Reads from job_state key 'track_targets_next' and clears it after completion

import { supabase } from '../supabase.js';
import { upsertTracksSafe, upsertPlaylistTracksSafe } from '../persistence.js';
import { fetchPlaylistItems } from '../youtube.js';

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

export async function fetchTracks() {
  // Load prepared targets
  const { data, error } = await supabase
    .from('job_state')
    .select('value')
    .eq('key', 'track_targets_next')
    .maybeSingle();
  if (error) { console.warn('[tracks] ⚠️ failed to load warm-up targets:', error.message); return; }
  const payload = data?.value || {};
  const list = Array.isArray(payload.playlists) ? payload.playlists : [];
  if (!list.length) { console.log('[tracks] ⚠️ no prepared targets available'); return; }

  const BATCH = 200;
  const batches = Math.min(5, Math.ceil(list.length / BATCH));
  for (let b = 0; b < batches; b++) {
    const slice = list.slice(b * BATCH, b * BATCH + BATCH);
    const tracksBuf = [];
    const linksBuf = [];
    for (let i = 0; i < slice.length; i++) {
      const pl = slice[i];
      await sleep(180 + Math.floor(Math.random()*41));
      try {
        const items = await fetchPlaylistItems(pl.external_id, 1);
        const LIM = 200;
        for (let k = 0; k < Math.min(items.length, LIM); k++) {
          const item = items[k];
          const vid = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId || null;
          if (!vid) continue;
          tracksBuf.push({
            external_id: vid,
            title: item?.snippet?.title || null,
            artist: item?.snippet?.videoOwnerChannelTitle || item?.snippet?.channelTitle || null,
            cover_url: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.default?.url || null,
          });
          linksBuf.push({ playlist_id: pl.id, external_id: vid, position: k+1 });
        }
      } catch {}
      if (((b*BATCH)+i+1) % 1000 === 0) {
        console.log(`[tracks] ⏱ progress: ${Math.min((b*BATCH)+i+1, batches*BATCH)}/${Math.min(list.length, batches*BATCH)} playlists fetched`);
      }
    }
    if (tracksBuf.length) {
      await upsertTracksSafe(tracksBuf, 500);
      // map external_id → id
      const ids = Array.from(new Set(linksBuf.map(l=>l.external_id)));
      const idMap = new Map();
      for (let p = 0; p < ids.length; p += 500) {
        const chunk = ids.slice(p, p+500);
        const { data: d } = await supabase.from('tracks').select('id,external_id').in('external_id', chunk);
        for (const r of (d||[])) idMap.set(r.external_id, r.id);
      }
      const linkRows = linksBuf.map(l=>({ playlist_id: l.playlist_id, track_id: idMap.get(l.external_id), position: l.position })).filter(x=>x.track_id);
      if (linkRows.length) await upsertPlaylistTracksSafe(linkRows, 500);
    }
  }
  // Clear prepared targets after processing
  await supabase.from('job_state').delete().eq('key','track_targets_next');
}

export default { fetchTracks };
