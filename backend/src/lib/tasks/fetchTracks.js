// backend/src/lib/tasks/fetchTracks.js
// ⏱ FetchTracks every 30 min starting at 13:00 Europe/Budapest (20 runs total)

import cron from 'node-cron';
import { supabase } from '../supabase.js';
import { upsertTracksSafe, upsertPlaylistTracksSafe } from '../persistence.js';
import { fetchPlaylistItems } from '../youtube.js';

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

export async function fetchTracks(slotLabel = '0000') {
  const key = `track_targets_${slotLabel}`;
  const { data, error } = await supabase.from('job_state').select('value').eq('key', key).maybeSingle();
  if (error) { console.warn(`[fetch:${slotLabel}] ⚠️ failed to load warm-up targets:`, error.message); return; }

  const payload = data?.value || {};
  const list = Array.isArray(payload.playlists) ? payload.playlists : [];
  if (!list.length) { console.log(`[fetch:${slotLabel}] ⚠️ no prepared playlists`); return; }

  const BATCH = 200;
  const batches = Math.min(5, Math.ceil(list.length / BATCH));

  for (let b = 0; b < batches; b++) {
    const slice = list.slice(b * BATCH, b * BATCH + BATCH);
    const tracksBuf = [];
    const linksBuf = [];

    for (const pl of slice) {
      await sleep(180 + Math.floor(Math.random() * 41));
      try {
        const items = await fetchPlaylistItems(pl.external_id, 1);
        for (let k = 0; k < Math.min(items.length, 200); k++) {
          const item = items[k];
          const vid = item?.contentDetails?.videoId || item?.snippet?.resourceId?.videoId;
          if (!vid) continue;
          tracksBuf.push({
            external_id: vid,
            title: item?.snippet?.title || null,
            artist: item?.snippet?.videoOwnerChannelTitle || item?.snippet?.channelTitle || null,
            cover_url: item?.snippet?.thumbnails?.high?.url || item?.snippet?.thumbnails?.default?.url || null,
          });
          linksBuf.push({ playlist_id: pl.id, external_id: vid, position: k + 1 });
        }
      } catch (e) {
        console.warn(`[fetch:${slotLabel}] ⚠️ error on ${pl.external_id}:`, e?.message || e);
      }
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

  await supabase.from('job_state').delete().eq('key', key);
  console.log(`[fetch:${slotLabel}] ✅ finished & cleared ${key}`);
}

// 🔁 Fetch schedule: 13:00, 13:30, 14:00, 14:30, ... (20 runs total)
const fetchSlots = [];
let hour = 13, minute = 0;
for (let i = 0; i < 20; i++) {
  fetchSlots.push(`${minute} ${hour} * * *`);
  minute += 30;
  if (minute >= 60) { minute -= 60; hour = (hour + 1) % 24; }
}

export function startFetchSchedule() {
  const TZ = process.env.TZ || 'Europe/Budapest';
  fetchSlots.forEach((pattern, i) => {
    const label = `${String(i + 1).padStart(2, '0')}`;
    cron.schedule(pattern, async () => {
      console.log(`[scheduler] 🎵 Fetch slot ${label} triggered (${pattern} ${TZ})`);
      await fetchTracks(label);
    }, { timezone: TZ });
  });
  console.log(`[fetchTracks] ✅ 20 fetch jobs scheduled from 13:00 every 30 min (${TZ})`);
}
