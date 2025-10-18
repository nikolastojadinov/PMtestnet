import { log } from '../utils/logger.js'
import { youtubeClient } from './client.js'
import { supabase } from '../supabase/client.js'
import { playlistUuid, trackUuid } from '../utils/id.js'

const REGIONS = ['IN', 'VN', 'PH', 'KR', 'US', 'JP', 'CN', 'RU'] as const

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

function isTransient(err: any): boolean {
  const code = err?.code
  const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || ''
  const message = String(err?.message || '').toLowerCase()
  if (typeof code === 'number' && code >= 500) return true
  if (/quota|rate|timeout|timed out|reset|ecoon|etimedout|enotfound/i.test(message)) return true
  if (/quota|rateLimit|backendError|internalError/i.test(reason)) return true
  return false
}

async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 2): Promise<T> {
  let attempt = 0
  let delay = 2000
  // attempt + retries = total tries (e.g., 3 total when retries=2)
  for (;;) {
    try {
      return await fn()
    } catch (err: any) {
      attempt++
      if (attempt > retries || !isTransient(err)) {
        throw err
      }
      log('warn', `${label} transient error, retrying in ${delay}ms`, { error: err?.message })
      await sleep(delay)
      delay *= 2
    }
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

class TimeoutError extends Error { constructor(message: string) { super(message); this.name = 'TimeoutError' } }

async function runWithTimeout<T>(fn: () => Promise<T>, ms: number, region: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(`Region=${region} exceeded ${ms}ms`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// Returns the number of playlists processed (backward compatible with scheduler logs).
// Also prints TOTAL logs including both playlists and tracks across all regions.
export async function fetchNewPlaylists(playlistIds?: string[]): Promise<number> {
  const yt = youtubeClient()

  // Manual mode: process explicit playlist IDs
  if (playlistIds && playlistIds.length > 0) {
    const ids = playlistIds
    log('info', `Manual fetch: ${ids.length} playlists`)
    let totalTracks = 0
    let totalPlaylists = 0
    const rich = process.env.SUPABASE_RICH_SCHEMA === '1'

    for (const pid of ids) {
      try {
        const p = await withRetry(() => yt.playlists.list({ id: [pid], part: ['snippet', 'contentDetails'], maxResults: 1 }), 'playlists.list')
        const item = p.data.items?.[0]
        if (!item) continue
        const playlistRows: any[] = []
        const id = playlistUuid(item.id!)
        if (rich) {
          playlistRows.push({
            id,
            external_id: item.id!,
            name: item.snippet?.title || 'Untitled',
            description: item.snippet?.description ?? null,
            cover_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
            updated_at: new Date().toISOString(),
          })
        } else {
          playlistRows.push({ id, name: item.snippet?.title || 'Untitled' })
        }
        // Upsert playlist row (single)
        try { await (supabase as any).from('playlists').upsert(playlistRows) } catch (e: any) { log('warn', 'Supabase playlist upsert failed', { error: e?.message }) }
        totalPlaylists++

        // Fetch playlist items and upsert tracks + links in batches per page
        let pageToken: string | undefined
        let positionBase = 0
        do {
          const r = await withRetry(() => yt.playlistItems.list({
            playlistId: pid,
            part: ['snippet', 'contentDetails'],
            maxResults: 50,
            pageToken,
          }), 'playlistItems.list')
          const its = r.data.items || []

          const trackRows: any[] = []
          const linkRows: any[] = []
          for (let i = 0; i < its.length; i++) {
            try {
              const it = its[i]
              const vid = it.contentDetails?.videoId
              if (!vid) continue
              const title = it.snippet?.title || 'Untitled'
              const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
              const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
              const tid = trackUuid(vid)
              if (rich) {
                trackRows.push({ id: tid, external_id: vid, title, artist: channelTitle ?? null, published_at: it.contentDetails?.videoPublishedAt ?? null, thumbnail_url: thumb ?? null, updated_at: new Date().toISOString() })
              } else {
                trackRows.push({ id: tid, title })
              }
              linkRows.push({ playlist_id: id, track_id: tid, position: positionBase + i, updated_at: new Date().toISOString() })
              totalTracks++
            } catch (e: any) {
              log('warn', `Track build failed for playlist=${pid}`, { error: e?.message })
            }
          }

          // Batch upserts (<=50 per page) with safe chunking anyway
          for (const batch of chunk(trackRows, 50)) {
            try { await (supabase as any).from('tracks').upsert(batch) } catch (e: any) { log('warn', 'Supabase tracks upsert failed', { error: e?.message }) }
          }
          for (const batch of chunk(linkRows, 50)) {
            try { await (supabase as any).from('playlist_tracks').upsert(batch) } catch (e: any) { log('warn', 'Supabase playlist_tracks upsert failed', { error: e?.message }) }
          }

          positionBase += its.length
          pageToken = r.data.nextPageToken || undefined
        } while (pageToken)
      } catch (err: any) {
        log('error', `Manual fetch failed: ${pid}`, { error: err?.message })
      }
    }
    log('info', `[TOTAL] Manual fetch completed: ${totalPlaylists} playlists, ${totalTracks} tracks`)
    return totalPlaylists
  }

  // Discovery mode across all regions
  log('info', `[DISCOVERY] Starting global region discovery mode`)
  let totalPlaylists = 0
  let totalTracks = 0
  const rich = process.env.SUPABASE_RICH_SCHEMA === '1'

  for (const region of REGIONS) {
    log('info', `[FETCH] Starting region=${region}`)
    let regionPlaylists = 0
    let regionTracks = 0
    try {
      await runWithTimeout(async () => {
        // Discover playlists for region
        const res = await withRetry(() => yt.search.list({
          part: ['snippet'],
          type: ['playlist'],
          q: 'music',
          order: 'viewCount',
          regionCode: region,
          relevanceLanguage: 'en',
          maxResults: 50,
        }), 'search.list')
        const items = res.data.items || []
        const discovered = items.map(i => i.id?.playlistId).filter(Boolean) as string[]
        regionPlaylists = discovered.length

        // Fetch details for all discovered playlists (sequential with retry)
        type PDetail = { pid: string, item: any }
        const details: PDetail[] = []
        for (const pid of discovered) {
          try {
            const p = await withRetry(() => yt.playlists.list({ id: [pid], part: ['snippet', 'contentDetails'], maxResults: 1 }), 'playlists.list')
            const item = p.data.items?.[0]
            if (item) details.push({ pid, item })
          } catch (e: any) {
            log('warn', `Playlist fetch failed: ${pid}`, { error: e?.message })
          }
        }

        // Batch upsert all playlists for the region (<=50)
        const playlistRows: any[] = details.map(({ item }) => {
          const id = playlistUuid(item.id!)
          if (rich) {
            return {
              id,
              external_id: item.id!,
              name: item.snippet?.title || 'Untitled',
              description: item.snippet?.description ?? null,
              cover_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
              region,
              category: 'Music',
              item_count: (item.contentDetails as any)?.itemCount ?? null,
              channel_title: item.snippet?.channelTitle ?? null,
              updated_at: new Date().toISOString(),
            }
          }
          return { id, name: item.snippet?.title || 'Untitled' }
        })
        if (playlistRows.length > 0) {
          for (const batch of chunk(playlistRows, 50)) {
            try { await (supabase as any).from('playlists').upsert(batch) } catch (e: any) { log('warn', 'Supabase playlists upsert failed', { error: e?.message }) }
          }
        }

        totalPlaylists += regionPlaylists

        // For each playlist, fetch items and batch upsert
        for (const { pid, item } of details) {
          const playlistIdUuid = playlistUuid(item.id!)
          let pageToken: string | undefined
          let positionBase = 0
          do {
            try {
              const r = await withRetry(() => yt.playlistItems.list({
                playlistId: pid,
                part: ['snippet', 'contentDetails'],
                maxResults: 50,
                pageToken,
              }), 'playlistItems.list')
              const its = r.data.items || []
              const trackRows: any[] = []
              const linkRows: any[] = []
              for (let i = 0; i < its.length; i++) {
                try {
                  const it = its[i]
                  const vid = it.contentDetails?.videoId
                  if (!vid) continue
                  const title = it.snippet?.title || 'Untitled'
                  const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
                  const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
                  const tid = trackUuid(vid)
                  if (rich) {
                    trackRows.push({ id: tid, external_id: vid, title, artist: channelTitle ?? null, published_at: it.contentDetails?.videoPublishedAt ?? null, thumbnail_url: thumb ?? null, updated_at: new Date().toISOString() })
                  } else {
                    trackRows.push({ id: tid, title })
                  }
                  linkRows.push({ playlist_id: playlistIdUuid, track_id: tid, position: positionBase + i, updated_at: new Date().toISOString() })
                  regionTracks++
                } catch (e: any) {
                  log('warn', `Track build failed for playlist=${pid}`, { error: e?.message })
                }
              }
              for (const batch of chunk(trackRows, 50)) {
                try { await (supabase as any).from('tracks').upsert(batch) } catch (e: any) { log('warn', 'Supabase tracks upsert failed', { error: e?.message }) }
              }
              for (const batch of chunk(linkRows, 50)) {
                try { await (supabase as any).from('playlist_tracks').upsert(batch) } catch (e: any) { log('warn', 'Supabase playlist_tracks upsert failed', { error: e?.message }) }
              }

              positionBase += its.length
              pageToken = r.data.nextPageToken || undefined
            } catch (e: any) {
              log('warn', `playlistItems.list failed for playlist=${pid}`, { error: e?.message })
              break
            }
          } while (pageToken)
        }
      }, 120000, region)
    } catch (err: any) {
      if (err?.name === 'TimeoutError') {
        log('warn', `[WARN] Region=${region} stalled >120s, skipping to next`)
      } else {
        log('error', `[ERROR] Region=${region} failed: ${err?.message ?? 'unknown'}`)
      }
    }

    totalTracks += regionTracks
    log('info', `[FETCH] Completed region=${region} (${regionPlaylists} playlists, ${regionTracks} tracks)`)

    // Pacing between regions
    await sleep(1200)
  }

  log('info', `[TOTAL] Discovery completed: ${totalPlaylists} playlists, ${totalTracks} tracks across ${REGIONS.length} regions`)
  return totalPlaylists
}
