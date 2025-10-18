import { youtubeClient } from './client.js'
import { linkTrackToPlaylist, upsertPlaylist, upsertTrack } from '../supabase/helpers.js'
import { log, logJob } from '../utils/logger.js'
import { ingestInit, ingestMarkStart, ingestMarkResult, ingestFinish } from '../state/ingestState.js'

export async function fetchNewPlaylists(playlistIds: string[]) {
  const yt = youtubeClient()
  ingestInit('FETCH', 'unknown', playlistIds)
  for (const pid of playlistIds) {
    await logJob({ target: `fetch:${pid}`, status: 'started' })
    ingestMarkStart(pid)
    try {
      const { item, keyUsed } = await yt.getPlaylist(pid)
      if (!item) {
        await logJob({ target: `fetch:${pid}`, status: 'error', key_used: keyUsed, error: 'Playlist not found' })
        ingestMarkResult(pid, { itemsFetched: 0, tracksLinked: 0, error: 'Playlist not found' })
        continue
      }

      await upsertPlaylist({
        id: item.id!,
        title: item.snippet?.title || 'Untitled',
        description: item.snippet?.description || null,
        thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
      })

  const { items, keyUsed: key2 } = await yt.getPlaylistItems(pid)
      const keyFinal = key2 ?? keyUsed ?? undefined

      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const vid = it.contentDetails?.videoId
        if (!vid) continue
        const title = it.snippet?.title || 'Untitled'
        const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
        const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
        await upsertTrack({ id: vid, title, channelTitle, publishedAt: it.contentDetails?.videoPublishedAt || null, thumbnail_url: thumb })
        await linkTrackToPlaylist(pid, vid, i)
      }

      await logJob({ target: `fetch:${pid}`, status: 'success', key_used: keyFinal ?? null })
      ingestMarkResult(pid, { itemsFetched: items.length, tracksLinked: items.length, error: null })
    } catch (e: any) {
      log('error', 'fetchNewPlaylists failed', { pid, error: e?.message })
      await logJob({ target: `fetch:${pid}`, status: 'error', error: e?.message || String(e) })
      ingestMarkResult(pid, { itemsFetched: 0, tracksLinked: 0, error: e?.message || String(e) })
    }
  }
  ingestFinish()
}
