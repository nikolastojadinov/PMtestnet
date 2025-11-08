// Fetch tracks task (20-slot version starting at 12:55 / 13:00 cycle)
// Reads from job_state key track_targets_<slotLabel> and clears only that slot key

import { supabase } from '../supabase.js';
import { upsertTracksSafe, upsertPlaylistTracksSafe } from '../persistence.js';
import { fetchPlaylistItems } from '../youtube.js';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export async function fetchTracks(slotLabel = '1255') {
  const key = `track_targets_${slotLabel}`;
  const { data, error } = await supabase.from('job_state').select('value').eq('key', key).maybeSingle();
  if (error) { console.warn(`[tracks:${slotLabel}] ⚠️ failed to load warm-up targets:`, error.message); return; }

  const payload = data?.value || {};
  const list = Array.isArray(payload.playlists) ? payload.playlists : [];
  if (!list.length) { console.log(`[tracks:${slotLabel}] ⚠️ no prepared targets`); return; }

  const BATCH = 200;
  const batches = Math.min(5, Math.ceil(list.length / BATCH));
  for (let b = 0; b < batches; b++) {
    const slice = list.slice(b * BATCH, b * BATCH + BATCH);
    const tracksBuf = [];
    const linksBuf = [];
    for (let i = 0; i < slice.length; i++) {
      const pl = slice[i];
      await sleep(180 + Math.floor(Math.random() * 41));
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
          linksBuf.push({ playlist_id: pl.id, external_id: vid, position: k + 1 });
        }
      } catch {}
    }

    if (tracksBuf.length) {
      await upsertTracksSafe(tracksBuf, 500);
      const ids = Array.from(new Set(linksBuf.map(l => l.external_id)));
      const idMap = new Map();
      for (let p = 0; p < ids.length; p += 500) {
        const chunk = ids.slice(p, p + 500);
        const { data: d } = await supabase.from('tracks').select('id,external_id').in('external_id', chunk);
        for (const r of (d || [])) idMap.set(r.external_id, r.id);
      }
      const linkRows = linksBuf.map(l => ({
        playlist_id: l.playlist_id,
        track_id: idMap.get(l.external_id),
        position: l.position,
      })).filter(x => x.track_id);
      if (linkRows.length) await upsertPlaylistTracksSafe(linkRows, 500);
    }
  }

  // Clear only current slot's prepared targets
  await supabase.from('job_state').delete().eq('key', key);
  console.log(`[tracks:${slotLabel}] ✅ finished & cleared ${key}`);
}

export default { fetchTracks };
