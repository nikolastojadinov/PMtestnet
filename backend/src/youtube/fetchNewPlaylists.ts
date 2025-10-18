import { log } from '../utils/logger.js'
import { youtubeClient } from './client.js'
import { upsertPlaylist, upsertTrack, linkTrackToPlaylist } from '../supabase/helpers.js'

const REGIONS = ['IN', 'VN', 'PH', 'KR', 'US', 'JP', 'CN', 'RU'] as const

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

// Returns the number of playlists processed (for backward compatibility with scheduler logs).
// Also prints TOTAL logs including both playlists and tracks across all regions.
export async function fetchNewPlaylists(playlistIds?: string[]): Promise<number> {
  const yt = youtubeClient()

  // Manual mode: process explicit playlist IDs
  if (playlistIds && playlistIds.length > 0) {
    const ids = playlistIds
    log('info', `Manual fetch: ${ids.length} playlists`)
    let totalTracks = 0
    for (const pid of ids) {
      try {
        const p = await yt.playlists.list({ id: [pid], part: ['snippet', 'contentDetails'], maxResults: 1 })
        const item = p.data.items?.[0]
        if (!item) continue
        await upsertPlaylist({
          id: item.id!,
          title: item.snippet?.title || 'Untitled',
          description: item.snippet?.description || null,
          thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
        })

        // Fetch playlist items and upsert tracks + links
        let pageToken: string | undefined
        let positionBase = 0
        do {
          const r = await yt.playlistItems.list({
            playlistId: pid,
            part: ['snippet', 'contentDetails'],
            maxResults: 50,
            pageToken,
          })
          const its = r.data.items || []
          for (let i = 0; i < its.length; i++) {
            try {
              const it = its[i]
              const vid = it.contentDetails?.videoId
              if (!vid) continue
              const title = it.snippet?.title || 'Untitled'
              const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
              const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
              await upsertTrack({ id: vid, title, channelTitle, publishedAt: it.contentDetails?.videoPublishedAt || null, thumbnail_url: thumb })
              await linkTrackToPlaylist(pid, vid, positionBase + i)
              totalTracks++
            } catch (e: any) {
              log('warn', `Track upsert/link failed for playlist=${pid}`, { error: e?.message })
            }
          }
          positionBase += its.length
          pageToken = r.data.nextPageToken || undefined
        } while (pageToken)
      } catch (err: any) {
        log('error', `Manual fetch failed: ${pid}`, { error: err?.message })
      }
    }
    log('info', `[TOTAL] Manual fetch completed: ${ids.length} playlists, ${totalTracks} tracks`)
    return ids.length
  }

  // Discovery mode across all regions
  let totalPlaylists = 0
  let totalTracks = 0
  for (const region of REGIONS) {
    log('info', `[FETCH] Starting region=${region}`)
    let regionPlaylists = 0
    let regionTracks = 0
    try {
      // Discover playlists for region
      const res = await yt.search.list({
        part: ['snippet'],
        type: ['playlist'],
        q: 'music',
        order: 'viewCount',
        regionCode: region,
        relevanceLanguage: 'en',
        maxResults: 50,
      })
      const items = res.data.items || []
      const discovered = items.map(i => i.id?.playlistId).filter(Boolean) as string[]
      regionPlaylists = discovered.length

      for (const pid of discovered) {
        try {
          const p = await yt.playlists.list({ id: [pid], part: ['snippet', 'contentDetails'], maxResults: 1 })
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
            itemCount: (item.contentDetails as any)?.itemCount ?? null,
            channelTitle: item.snippet?.channelTitle ?? null,
          })

          // Fetch playlist items and upsert tracks + links
          let pageToken: string | undefined
          let positionBase = 0
          do {
            try {
              const r = await yt.playlistItems.list({
                playlistId: pid,
                part: ['snippet', 'contentDetails'],
                maxResults: 50,
                pageToken,
              })
              const its = r.data.items || []
              for (let i = 0; i < its.length; i++) {
                try {
                  const it = its[i]
                  const vid = it.contentDetails?.videoId
                  if (!vid) continue
                  const title = it.snippet?.title || 'Untitled'
                  const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
                  const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
                  await upsertTrack({ id: vid, title, channelTitle, publishedAt: it.contentDetails?.videoPublishedAt || null, thumbnail_url: thumb })
                  await linkTrackToPlaylist(pid, vid, positionBase + i)
                  regionTracks++
                } catch (e: any) {
                  log('warn', `Track upsert/link failed for playlist=${pid}`, { error: e?.message })
                }
              }
              positionBase += its.length
              pageToken = r.data.nextPageToken || undefined
            } catch (e: any) {
              log('warn', `playlistItems.list failed for playlist=${pid}`, { error: e?.message })
              break
            }
          } while (pageToken)
        } catch (err: any) {
          log('warn', `Playlist fetch failed: ${pid}`, { error: err?.message })
        }
      }
    } catch (err: any) {
      log('error', `[ERROR] Region=${region} failed with message: ${err?.message ?? 'unknown'}`)
    }

    totalPlaylists += regionPlaylists
    totalTracks += regionTracks
    log('info', `[FETCH] Completed region=${region} (${regionPlaylists} playlists, ${regionTracks} tracks)`)

    // Rate limit between regions: 1000–1500 ms
    await sleep(1000 + Math.floor(Math.random() * 501))
  }

  log('info', `[TOTAL] Discovery completed: ${totalPlaylists} playlists, ${totalTracks} tracks across all regions`)
  return totalPlaylists
}
