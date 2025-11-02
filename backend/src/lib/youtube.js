// ✅ FULL REWRITE v4.0 — YouTube API handlers for playlists and tracks

import { google } from 'googleapis';
import { nextKeyFactory, sleep } from './utils.js';

const youtube = google.youtube('v3');
const apiKeys = process.env.YOUTUBE_API_KEYS?.split(',').map(k => k.trim()) || [];
const getNextKey = nextKeyFactory(apiKeys);

// 🎧 Fetch Playlists
export async function fetchYouTubePlaylists(region = 'US', maxResults = 50) {
  const key = getNextKey();
  try {
    const res = await youtube.playlists.list({
      part: ['id', 'snippet', 'contentDetails'],
      chart: 'mostPopular',
      regionCode: region,
      maxResults,
      key,
    });
    return res.data.items || [];
  } catch (err) {
    console.error('[youtube] ❌ Error fetching playlists:', err.message);
    return [];
  }
}

// 🎵 Fetch Tracks from Playlist
export async function fetchTracksFromPlaylist(playlistId) {
  const key = getNextKey();
  let allTracks = [];
  let nextPageToken = null;

  try {
    do {
      const res = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId,
        maxResults: 200,
        pageToken: nextPageToken || '',
        key,
      });

      const tracks = res.data.items.map(item => ({
        id: item.contentDetails.videoId,
        title: item.snippet?.title,
        artist: item.snippet?.videoOwnerChannelTitle,
        duration: null,
        cover_url: item.snippet?.thumbnails?.high?.url,
      }));

      allTracks.push(...tracks);
      nextPageToken = res.data.nextPageToken;
      await sleep(300);
    } while (nextPageToken);

    return allTracks;
  } catch (err) {
    console.error('[youtube] ❌ Error fetching tracks:', err.message);
    return [];
  }
}
