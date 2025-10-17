import { YouTubeClient } from './client.js'
import { upsertPlaylist, upsertTrack, linkTrackToPlaylist } from '../supabase/helpers.js'
import { log } from '../utils/logger.js'

type UpsertStats = { inserted: number; updated: number; skipped: number }

export async function fetchYouTubePlaylists(yt: YouTubeClient, playlistIds: string[], limitPerRegion = 50) {
  const results: { id: string; playlist?: any }[] = []
  for (const pid of playlistIds.slice(0, limitPerRegion)) {
    try {
      const { item } = await yt.getPlaylist(pid)
      results.push({ id: pid, playlist: item })
    } catch (e: any) {
      log('warn', 'fetch playlist failed', { pid, error: e?.message })
      results.push({ id: pid })
    }
  }
  return results
}

export async function upsertPlaylistsToSupabase(yt: YouTubeClient, entries: { region?: string; playlist?: any }[]): Promise<UpsertStats> {
  let inserted = 0, updated = 0, skipped = 0
  for (const e of entries) {
    const item = e.playlist
    if (!item?.id) { skipped++; continue }

    // Try to enrich with channel stats if available
    let channelTitle: string | null = item.snippet?.channelTitle || null
    let channelSubscriberCount: number | null = null
    try {
      const channelId = item.snippet?.channelId
      if (channelId) {
        const { item: ch } = await yt.getChannelDetails(channelId)
        if (ch) {
          channelTitle = ch.snippet?.title || channelTitle
          const subs = ch.statistics?.subscriberCount
          channelSubscriberCount = subs ? Number(subs) : null
        }
      }
    } catch {}

    await upsertPlaylist({
      id: item.id,
      title: item.snippet?.title || 'Untitled',
      description: item.snippet?.description || null,
      thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
      region: e.region || null,
      category: 'Music',
      is_public: true,
      itemCount: item.contentDetails?.itemCount ?? null,
      channelTitle,
      fetched_on: new Date().toISOString(),
    })
    // We can't easily differentiate insert vs update without extra query; count as updated if existed hint
    if (item.contentDetails?.itemCount) updated++; else inserted++

    // Optionally ingest first page of tracks to link basic association
    try {
      const { items } = await yt.getPlaylistItems(item.id)
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const vid = it.contentDetails?.videoId
        if (!vid) continue
        const title = it.snippet?.title || 'Untitled'
        const chTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
        const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
        await upsertTrack({ id: vid, title, channelTitle: chTitle, publishedAt: it.contentDetails?.videoPublishedAt || null, thumbnail_url: thumb, created_at: new Date().toISOString() })
        await linkTrackToPlaylist(item.id, vid, i)
      }
    } catch (e: any) {
      log('warn', 'playlist items ingest failed', { playlistId: item.id, error: e?.message })
    }
  }
  return { inserted, updated, skipped }
}
