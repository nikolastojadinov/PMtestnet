import { google } from 'googleapis';
import { supabase } from '../utils/supabaseClient.js';

const YOUTUBE_KEYS = process.env.YOUTUBE_API_KEYS
  ? process.env.YOUTUBE_API_KEYS.split(',').map(k => k.trim())
  : [];

let currentKeyIndex = 0;
let cooldownUntil = null;
const delay = ms => new Promise(res => setTimeout(res, ms));

// Log key count early for deploy diagnostics
console.log(`[INFO] [YouTube] Initialized ${YOUTUBE_KEYS.length} API key(s)`);

function getCurrentKey() {
  return YOUTUBE_KEYS[currentKeyIndex];
}

function rotateKey() {
  currentKeyIndex = (currentKeyIndex + 1) % YOUTUBE_KEYS.length;
  console.log(`[INFO] [YouTube] Switched to key ${currentKeyIndex + 1}/${YOUTUBE_KEYS.length}`);
  return getCurrentKey();
}

export async function fetchPlaylistsForRegion(region, mode = 'FETCH') {
  if (cooldownUntil && Date.now() < cooldownUntil) {
    console.warn(`[COOLDOWN] Waiting until ${new Date(cooldownUntil).toISOString()}`);
    return 'COOLDOWN';
  }

  const youtube = google.youtube({ version: 'v3', auth: getCurrentKey() });
  const searchTerms = ['top music', 'latest hits', 'pop songs', 'official playlist', 'love songs'];

  try {
    for (const query of searchTerms) {
      console.log(`[INFO] Searching region=${region}, query="${query}"`);

      const searchRes = await youtube.search.list({
        part: ['snippet'],
        type: ['playlist'],
        regionCode: region,
        maxResults: 5,
        q: query,
      });

      const playlists = searchRes.data.items || [];

      for (const pl of playlists) {
        const playlistId = pl.id.playlistId;
        const playlistRes = await youtube.playlists.list({
          part: ['snippet', 'contentDetails'],
          id: [playlistId],
        });

        const playlist = playlistRes.data.items?.[0];
        if (!playlist) continue;

        const plTitle = playlist.snippet.title;
        const plDesc = playlist.snippet.description || '';
        const plCover = playlist.snippet.thumbnails?.high?.url || null;
        const channelTitle = playlist.snippet.channelTitle;
        const etag = playlist.etag;

        const { data: existing } = await supabase
          .from('playlists')
          .select('id, last_etag')
          .eq('external_id', playlistId)
          .single();

        if (existing && existing.last_etag === etag && mode === 'REFRESH') continue;

        const { data: plData, error: plErr } = await supabase.from('playlists').upsert({
          external_id: playlistId,
          title: plTitle,
          description: plDesc,
          cover_url: plCover,
          region,
          is_public: true,
          channel_title: channelTitle,
          fetched_on: new Date().toISOString(),
          last_refreshed_on: new Date().toISOString(),
          last_etag: etag,
        }).select();

        if (plErr) console.error('[ERROR] Playlist insert:', plErr);
        const playlistRow = plData?.[0];
        if (!playlistRow) continue;

        // Fetch playlist items
        const tracksRes = await youtube.playlistItems.list({
          part: ['snippet', 'contentDetails'],
          playlistId,
          maxResults: 50,
        });

        const items = tracksRes.data.items || [];
        for (const item of items) {
          const vidId = item.contentDetails?.videoId;
          if (!vidId) continue;
          const title = item.snippet?.title;
          const artist = item.snippet?.videoOwnerChannelTitle || null;
          const cover = item.snippet?.thumbnails?.high?.url || null;

          const { data: trackData, error: trackErr } = await supabase
            .from('tracks')
            .upsert({
              external_id: vidId,
              title,
              artist,
              cover_url: cover,
              source: 'youtube',
              sync_status: 'youtube',
              created_at: new Date().toISOString(),
            })
            .select();

          if (trackErr) console.error('[ERROR] Track insert:', trackErr);
          const trackRow = trackData?.[0];
          if (!trackRow) continue;

          await supabase.from('playlist_tracks').upsert({
            playlist_id: playlistRow.id,
            track_id: trackRow.id,
            added_at: new Date().toISOString(),
          });
        }
      }
      await delay(1500);
    }
    return 'OK';
  } catch (err) {
    if (err.message?.includes('quota')) {
      console.warn('[WARN] [QUOTA] Key exhausted, switching…');
      rotateKey();
      if (currentKeyIndex === YOUTUBE_KEYS.length - 1) {
        cooldownUntil = Date.now() + 60 * 60 * 1000;
        console.warn(`[WARN] All keys exhausted — cooldown 60min.`);
        return 'COOLDOWN';
      }
      return fetchPlaylistsForRegion(region, mode);
    }
    console.error('[ERROR] [YouTube]', err);
    return 'ERROR';
  }
}
