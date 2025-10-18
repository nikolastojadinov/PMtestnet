import { log } from '../utils/logger.js'
import { youtubeClient } from './client.js'
import { upsertPlaylist, upsertTrack, linkTrackToPlaylist } from '../supabase/helpers.js'

const DEFAULT_REGIONS = ['IN', 'VN', 'PH', 'KR', 'US', 'JP', 'CN', 'RU']

export async function fetchNewPlaylists(playlistIds?: string[]): Promise<number> {
  const yt = youtubeClient()
  const ids = playlistIds && playlistIds.length > 0 ? playlistIds : []
  let totalProcessed = 0

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
        })
        const items = res.data.items || []
  const discovered = items.map(i => i.id?.playlistId).filter(Boolean) as string[]
  log('info', `[FETCH] region=${region}, discovered=${discovered.length}`)
  totalProcessed += discovered.length

  for (const pid of discovered) {
          const p = await yt.playlists.list({ id: [pid], part: ['snippet','contentDetails'], maxResults: 1 })
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
  totalProcessed += ids.length
  for (const pid of ids) {
      try {
      const p = await yt.playlists.list({ id: [pid], part: ['snippet','contentDetails'], maxResults: 1 })
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
  return totalProcessed
}
