import { google } from 'googleapis'
import { log } from '../utils/logger.js'
import { upsertPlaylist, upsertTrack, linkTrackToPlaylist } from '../supabase/helpers.js'

function readApiKey(): string | undefined {
  const raw = process.env.YOUTUBE_API_KEYS
  if (raw) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr[0]) return arr[0]
    } catch {
      const parts = raw.split(/[\s,]+/).filter(Boolean)
      if (parts[0]) return parts[0]
    }
  }
  return process.env.YOUTUBE_API_KEY_1 || process.env.YOUTUBE_API_KEY || undefined
}

export async function refreshExistingPlaylists(playlistIds: string[]) {
  const key = readApiKey()
  const yt = google.youtube('v3')
  for (const pid of playlistIds) {
    try {
      const p = await yt.playlists.list({ id: [pid], part: ['snippet','contentDetails'], maxResults: 1, auth: key })
      const item = p.data.items?.[0]
      if (item) {
        await upsertPlaylist({
          id: item.id!,
          title: item.snippet?.title || 'Untitled',
          description: item.snippet?.description || null,
          thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
        })
      }

      let pageToken: string | undefined
      let fetched = 0
      do {
        const r = await yt.playlistItems.list({
          playlistId: pid,
          part: ['snippet','contentDetails'],
          maxResults: 50,
          pageToken,
          auth: key,
        })
        const its = r.data.items || []
        for (let i = 0; i < its.length; i++) {
          const it = its[i]
          const vid = it.contentDetails?.videoId
          if (!vid) continue
          const title = it.snippet?.title || 'Untitled'
          const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
          const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
          await upsertTrack({ id: vid, title, channelTitle, publishedAt: it.contentDetails?.videoPublishedAt || null, thumbnail_url: thumb })
          await linkTrackToPlaylist(pid, vid, fetched + i)
        }
        fetched += its.length
        pageToken = r.data.nextPageToken || undefined
      } while (pageToken)
    } catch (err: any) {
      log('error', `Refresh failed: ${pid}`, { error: err?.message })
    }
  }
}
