import { google } from 'googleapis'
import { log } from '../utils/logger.js'
import { upsertPlaylist, upsertTrack, linkTrackToPlaylist } from '../supabase/helpers.js'

const DEFAULT_REGIONS = ['IN', 'VN', 'PH', 'KR', 'US', 'JP', 'CN', 'RU']

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

export async function fetchNewPlaylists(playlistIds?: string[]) {
  const key = readApiKey()
  const yt = google.youtube('v3')
  const ids = playlistIds && playlistIds.length > 0 ? playlistIds : []

  if (ids.length === 0) {
    log('info', 'No playlist IDs provided; discovering region playlists...')
    for (const region of DEFAULT_REGIONS) {
      try {
        const res = await yt.search.list({
          part: ['snippet'],
          type: ['playlist'],
          regionCode: region,
          maxResults: 50,
          videoCategoryId: '10',
          auth: key,
        })
        const items = res.data.items || []
        const ids = items.map(i => i.id?.playlistId).filter(Boolean) as string[]
        log('info', `[FETCH] region=${region}, discovered=${ids.length}`)

        for (const pid of ids) {
          const p = await yt.playlists.list({ id: [pid], part: ['snippet','contentDetails'], maxResults: 1, auth: key })
          const item = p.data.items?.[0]
          if (!item) continue
          await upsertPlaylist({
            id: item.id!,
            title: item.snippet?.title || 'Untitled',
            description: item.snippet?.description || null,
            thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
            region,
            category: 'Music',
            is_public: true,
          })

          // Fetch playlist items and upsert tracks + links
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
        }
      } catch (err: any) {
        log('error', `Region fetch failed: ${region}`, { error: err?.message })
      }
    }
  } else {
    log('info', `Manual fetch: ${ids.length} playlists`)
    for (const pid of ids) {
      try {
        const p = await yt.playlists.list({ id: [pid], part: ['snippet','contentDetails'], maxResults: 1, auth: key })
        const item = p.data.items?.[0]
        if (!item) continue
        await upsertPlaylist({
          id: item.id!,
          title: item.snippet?.title || 'Untitled',
          description: item.snippet?.description || null,
          thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
        })

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
        log('error', `Manual fetch failed: ${pid}`, { error: err?.message })
      }
    }
  }
}
