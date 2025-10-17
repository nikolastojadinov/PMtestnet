import dotenv from 'dotenv'
import { YouTubeClient } from '../youtube/client.js'
import { log, logJob } from '../utils/logger.js'
import { upsertPlaylist, upsertTrack, linkTrackToPlaylist } from '../supabase/helpers.js'
import { pingSupabase } from '../supabase/client.js'

dotenv.config()

// Predefinisani regioni za Day 1
const REGIONS = ['IN','VN','PH','KR','US','JP','CN','RU']
// Primer ulaznih playlist ID-eva po regionu (po potrebi dopuniti iz REGIONS_FILE)
const DEFAULT_PLAYLISTS: Record<string, string[]> = {
  IN: ['PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI'],
  US: ['PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj'],
  VN: [], PH: [], KR: [], JP: [], CN: [], RU: []
}

async function importPlaylist(yt: YouTubeClient, playlistId: string, region?: string) {
  await logJob({ target: `day1:${playlistId}`, status: 'started' })
  try {
    const { item, keyUsed } = await yt.getPlaylist(playlistId)
    if (!item) throw new Error('Playlist not found')
    await upsertPlaylist({
      id: item.id!,
      title: item.snippet?.title || 'Untitled',
      description: item.snippet?.description || null,
      thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
      region: region || null,
      category: 'Music',
      is_public: true,
      itemCount: item.contentDetails?.itemCount ?? null,
      channelTitle: item.snippet?.channelTitle || null,
      fetched_on: new Date().toISOString(),
    })

    const { items } = await yt.getPlaylistItems(playlistId)
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const vid = it.contentDetails?.videoId
      if (!vid) continue
      const title = it.snippet?.title || 'Untitled'
      const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
      const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
      await upsertTrack({ id: vid, title, channelTitle, publishedAt: it.contentDetails?.videoPublishedAt || null, thumbnail_url: thumb, created_at: new Date().toISOString() })
      await linkTrackToPlaylist(playlistId, vid, i)
    }

    await logJob({ target: `day1:${playlistId}`, status: 'success', key_used: keyUsed ?? null })
  } catch (e: any) {
    log('error', 'Day1 import failed', { playlistId, error: e?.message })
    await logJob({ target: `day1:${playlistId}`, status: 'error', error: e?.message || String(e) })
  }
}

async function main() {
  const yt = new YouTubeClient()
  // Verify Supabase connectivity
  try {
    const ok = await pingSupabase()
    if (ok) log('info', 'Supabase client connected successfully.')
  } catch (e) {
    log('warn', 'Supabase connectivity check failed')
  }
  let imported = 0
  for (const r of REGIONS) {
    const ids = DEFAULT_PLAYLISTS[r] || []
    for (const pid of ids) {
      await importPlaylist(yt, pid, r)
      imported++
    }
  }
  log('info', `Initial playlist fetch completed successfully – ${imported} playlists imported.`)
}

main().catch((e) => {
  log('error', 'Day1 script crashed', { error: (e as Error).message })
  process.exit(1)
})
