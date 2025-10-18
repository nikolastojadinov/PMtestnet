import { log } from '../utils/logger.js'
import { youtubeClient, withKey, QuotaDepletedError } from './client.js'
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

async function safeUpsertQueue(
  table: string,
  dataArray: any[],
  options: Record<string, any> = {},
  batchSize = 20,
  timeoutMs = 5000
) {
  if (!dataArray || dataArray.length === 0) return
  const batches: any[][] = []
  for (let i = 0; i < dataArray.length; i += batchSize) {
    batches.push(dataArray.slice(i, i + batchSize))
  }
  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx]
    const batchNum = idx + 1
    const total = batches.length
    try {
      await Promise.race([
        (supabase as any).from(table).upsert(batch, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ])
    } catch (err: any) {
      const msg = err?.message === 'timeout' ? `timed out after ${timeoutMs}ms` : (err?.message || 'unknown')
      console.warn(`[WARN] ${table} batch ${batchNum}/${total} ${msg}`)
    }
  }
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

// Overloads: legacy array param or options with playlistIds/startRegion
type FetchOpts = { playlistIds?: string[], startRegion?: string }

export async function fetchNewPlaylists(arg?: string[] | FetchOpts): Promise<{ totalPlaylists: number, totalTracks: number, totalRegionsProcessed: number, lastRegion: string, unitsUsed: number }> {
  const yt = youtubeClient()
  const budget = Number(process.env.YT_BUDGET_PER_TICK || 3000)
  let unitsUsed = 0
  let regionsDone = 0
  let lastRegion: string = REGIONS[0]

  let opts: FetchOpts = {}
  if (Array.isArray(arg)) opts = { playlistIds: arg }
  else if (arg) opts = arg

  // Manual mode: process explicit playlist IDs
  if (opts.playlistIds && opts.playlistIds.length > 0) {
    const ids = opts.playlistIds
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
  try { await safeUpsertQueue('playlists', playlistRows) } catch (e: any) { log('warn', 'Supabase playlist upsert failed', { error: e?.message }) }
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

          // Safe queued upserts with per-batch timeout
          try { await safeUpsertQueue('tracks', trackRows) } catch (e: any) { log('warn', 'Supabase tracks upsert failed', { error: e?.message }) }
          try { await safeUpsertQueue('playlist_tracks', linkRows) } catch (e: any) { log('warn', 'Supabase playlist_tracks upsert failed', { error: e?.message }) }

          positionBase += its.length
          pageToken = r.data.nextPageToken || undefined
        } while (pageToken)
      } catch (err: any) {
        log('error', `Manual fetch failed: ${pid}`, { error: err?.message })
      }
    }
    log('info', `[TOTAL] Manual fetch completed: ${totalPlaylists} playlists, ${totalTracks} tracks`)
    return { totalPlaylists, totalTracks, totalRegionsProcessed: 0, lastRegion, unitsUsed }
  }

  // Discovery mode across all regions
  const startRegion = opts.startRegion && REGIONS.includes(opts.startRegion as any) ? (opts.startRegion as typeof REGIONS[number]) : REGIONS[0]
  const startIdx = REGIONS.indexOf(startRegion)
  const order: typeof REGIONS = [...REGIONS.slice(startIdx), ...REGIONS.slice(0, startIdx)] as any
  log('info', `[DISCOVERY] Starting global region discovery mode (start=${startRegion})`)
  let totalPlaylists = 0
  let totalTracks = 0
  const rich = process.env.SUPABASE_RICH_SCHEMA === '1'

  for (const region of order) {
    log('info', `[FETCH] Starting region=${region}`)
    let regionPlaylists = 0
    let regionTracks = 0
    const regionUnitsBefore = unitsUsed
    try {
      // Supabase heartbeat before region to avoid silent client hangs
      try {
        await (supabase as any).from('playlists').select('id').limit(1)
        console.log(`[STATE] Supabase connection OK before region=${region}`)
      } catch (hbErr: any) {
        log('warn', 'Supabase heartbeat failed', { error: hbErr?.message })
      }
      await runWithTimeout(async () => {
        // Try cache first
        const cacheRes = await (supabase as any)
          .from('discovered_playlists')
          .select('playlist_id')
          .eq('region', region)
          .limit(50)
        const cached = (cacheRes?.data || []).map((r: any) => r.playlist_id)

        // If cache insufficient and budget allows, call discovery
        let discovered: string[] = [...cached]
        if (discovered.length < 50) {
          const est = 100
          if (unitsUsed + est > budget) {
            log('info', `[BUDGET] Tick budget reached (used=${unitsUsed}/${budget})`)
          } else {
            const res = await withKey((kYt) => kYt.search.list({
              part: ['snippet'],
              type: ['playlist'],
              q: 'music',
              order: 'viewCount',
              regionCode: region,
              relevanceLanguage: 'en',
              maxResults: 50,
            }))
            unitsUsed += est
            const items = res.data.items || []
            const fresh = items.map(i => i.id?.playlistId).filter(Boolean) as string[]
            discovered = Array.from(new Set([...discovered, ...fresh]))
            // Cache the newly found playlist IDs
            const cacheRows = fresh.map(pid => ({ playlist_id: pid, region }))
            try { await safeUpsertQueue('discovered_playlists', cacheRows, { onConflict: ['playlist_id'] }) } catch {}
          }
        }
        regionPlaylists = discovered.length

        // Fetch details for all discovered playlists (sequential with retry)
        type PDetail = { pid: string, item: any }
        const details: PDetail[] = []
        for (const pid of discovered) {
          try {
            // playlists.list cost ~1 unit
            if (unitsUsed + 1 > budget) { log('info', `[BUDGET] Tick budget reached (used=${unitsUsed}/${budget})`); break }
            const p = await withKey((kYt) => kYt.playlists.list({ id: [pid], part: ['snippet', 'contentDetails'], maxResults: 1 }))
            unitsUsed += 1
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
          try { await safeUpsertQueue('playlists', playlistRows) } catch (e: any) { log('warn', 'Supabase playlists upsert failed', { error: e?.message }) }
        }

        totalPlaylists += regionPlaylists

        // For each playlist, fetch items and batch upsert
        for (const { pid, item } of details) {
          const playlistIdUuid = playlistUuid(item.id!)
          let pageToken: string | undefined
          let positionBase = 0
          do {
            try {
              // playlistItems.list cost ~1 unit
              if (unitsUsed + 1 > budget) { log('info', `[BUDGET] Tick budget reached (used=${unitsUsed}/${budget})`); break }
              const r = await withKey((kYt) => kYt.playlistItems.list({
                playlistId: pid,
                part: ['snippet', 'contentDetails'],
                maxResults: 50,
                pageToken,
              }))
              unitsUsed += 1
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
              try { await safeUpsertQueue('tracks', trackRows) } catch (e: any) { log('warn', 'Supabase tracks upsert failed', { error: e?.message }) }
              try { await safeUpsertQueue('playlist_tracks', linkRows) } catch (e: any) { log('warn', 'Supabase playlist_tracks upsert failed', { error: e?.message }) }

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
      } else if (err instanceof QuotaDepletedError) {
        log('warn', `[QUOTA] All API keys exhausted; finishing tick with cached items only`)
      } else {
        log('error', `[ERROR] Region=${region} failed: ${err?.message ?? 'unknown'}`)
      }
    }

    totalTracks += regionTracks
    const regionUnits = unitsUsed - regionUnitsBefore
    log('info', `[FETCH] Completed region=${region} (${regionPlaylists} playlists, ${regionTracks} tracks, units=${regionUnits})`)
    regionsDone++
    lastRegion = order[(order.indexOf(region) + 1) % order.length]

    // Pacing between regions
    await sleep(1200)

    // Stop if budget reached
    if (unitsUsed >= budget) {
      log('info', `[BUDGET] Tick budget reached (used=${unitsUsed}/${budget})`)
      break
    }
  }

  log('info', `[TOTAL] Discovery summary: regions_done=${regionsDone}, playlists=${totalPlaylists}, tracks=${totalTracks}, units=${unitsUsed}`)
  return { totalPlaylists, totalTracks, totalRegionsProcessed: regionsDone, lastRegion, unitsUsed }
}
