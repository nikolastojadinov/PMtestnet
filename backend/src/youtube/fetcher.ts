import { log } from '../utils/logger.js'
import { supabase } from '../supabase/client.js'
import { discoverPlaylistsForRegion } from './discovery.js'
import { withKey, QuotaDepletedError } from './client.js'
import { playlistUuid, trackUuid } from '../utils/id.js'

const REGIONS = ['IN', 'VN', 'PH', 'KR', 'US', 'JP', 'CN', 'RU'] as const

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)) }

class TimeoutError extends Error { constructor(msg: string){ super(msg); this.name = 'TimeoutError' } }

function runWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new TimeoutError(`timed out after ${ms}ms`)), ms) })
  ]).finally(() => { if (timer) clearTimeout(timer) })
}

async function safeUpsertQueue(
  table: string,
  dataArray: any[],
  options: Record<string, any> = {},
  batchSize = 50,
  timeoutMs = 7000
) {
  if (!dataArray || dataArray.length === 0) return
  const batches: any[][] = []
  for (let i = 0; i < dataArray.length; i += batchSize) batches.push(dataArray.slice(i, i + batchSize))
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

export type TickResult = { totalPlaylists: number, totalTracks: number, totalRegionsProcessed: number, lastRegion: string, unitsUsed: number }

export async function runDiscoveryTick(arg?: { playlistIds?: string[], startRegion?: string }): Promise<TickResult> {
  const budgetMax = Number(process.env.YT_BUDGET_PER_TICK || 3000)
  const forceReset = String(process.env.FORCE_BUDGET_RESET || '').toLowerCase() === 'true'
  const cacheTtlDays = Number(process.env.CACHE_TTL_DAYS || 7)
  let unitsUsed = 0
  let lastReset = Date.now()
  const canSpend = (cost: number) => unitsUsed + cost <= budgetMax
  const spend = (cost: number) => { unitsUsed += cost }

  const maybeReset = () => {
    if (!forceReset) return
    const now = Date.now()
    if (now - lastReset >= 2 * 60 * 60 * 1000) {
      unitsUsed = 0
      lastReset = now
      log('info', '[BUDGET] Force reset triggered')
    }
  }

  // --- Manual mode (fetch specific playlists) ---
  if (arg?.playlistIds && arg.playlistIds.length > 0) {
    const ids = Array.from(new Set(arg.playlistIds))
    log('info', `Manual fetch: ${ids.length} playlists`)
    let totalTracks = 0
    let totalPlaylists = 0
    const rich = process.env.SUPABASE_RICH_SCHEMA === '1'
    for (const pid of ids) {
      maybeReset()
      try {
        const p: any = await withKey((yt) => yt.playlists.list({ id: [pid], part: ['snippet', 'contentDetails'], maxResults: 1 }), { unitCost: 1, label: 'playlists.list:manual' })
        spend(1)
        const item = p.data.items?.[0]
        if (!item) continue
        const id = playlistUuid(item.id!)
        const playlistRows: any[] = [ rich ? {
          id,
          external_id: item.id!,
          name: item.snippet?.title || 'Untitled',
          description: item.snippet?.description ?? null,
          cover_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || null,
          item_count: (item.contentDetails as any)?.itemCount ?? null,
          channel_title: item.snippet?.channelTitle ?? null,
          updated_at: new Date().toISOString(),
        } : { id, name: item.snippet?.title || 'Untitled' } ]
        await safeUpsertQueue('playlists', playlistRows)
        totalPlaylists++

        let pageToken: string | undefined
        let positionBase = 0
        do {
          maybeReset()
          if (!canSpend(1)) break
          const r: any = await withKey((yt) => yt.playlistItems.list({ playlistId: pid, part: ['snippet','contentDetails'], maxResults: 50, pageToken }), { unitCost: 1, label: 'playlistItems.list:manual' })
          spend(1)
          const its = r.data.items || []
          const trackRows: any[] = []
          const linkRows: any[] = []
          for (let i = 0; i < its.length; i++) {
            const it = its[i]
            const vid = it.contentDetails?.videoId
            if (!vid) continue
            const title = it.snippet?.title || 'Untitled'
            const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
            const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
            const tid = trackUuid(vid)
            if (rich) trackRows.push({ id: tid, external_id: vid, title, artist: channelTitle ?? null, published_at: it.contentDetails?.videoPublishedAt ?? null, thumbnail_url: thumb ?? null, updated_at: new Date().toISOString() })
            else trackRows.push({ id: tid, title })
            linkRows.push({ playlist_id: id, track_id: tid, position: positionBase + i, updated_at: new Date().toISOString() })
            totalTracks++
          }
          await safeUpsertQueue('tracks', trackRows)
          await safeUpsertQueue('playlist_tracks', linkRows)
          positionBase += its.length
          pageToken = r.data.nextPageToken || undefined
        } while (pageToken)
      } catch (e: any) {
        log('warn', 'Manual fetch failed', { error: e?.message })
      }
    }
    log('info', `[TOTAL] Manual fetch completed: ${totalPlaylists} playlists, ${totalTracks} tracks`)
    return { totalPlaylists, totalTracks, totalRegionsProcessed: 0, lastRegion: REGIONS[0], unitsUsed }
  }

  // --- Discovery mode (automatic regional fetch) ---
  const startRegion = arg?.startRegion && (REGIONS as readonly string[]).includes(arg.startRegion) ? arg.startRegion as typeof REGIONS[number] : REGIONS[0]
  const startIdx = REGIONS.indexOf(startRegion)
  const order: typeof REGIONS = [...REGIONS.slice(startIdx), ...REGIONS.slice(0, startIdx)] as any
  log('info', `[DISCOVERY] Sequential global mode starting... (start=${startRegion})`)

  let totalPlaylists = 0
  let totalTracks = 0
  let regionsDone = 0
  let lastRegion: string = startRegion
  const rich = process.env.SUPABASE_RICH_SCHEMA === '1'

  for (const region of order) {
    const beforeUnits = unitsUsed
    maybeReset()
    log('info', `[FETCH] Starting region=${region}`)
    try {
      const discovery = await runWithTimeout(() => discoverPlaylistsForRegion(region, canSpend, spend, cacheTtlDays), 90000)
      const ids = discovery.playlistIds || []
      if (ids.length === 0) {
        log('warn', `[SKIP] No playlists found for region=${region}, moving to next`)
      } else {
        const detailIds = Array.from(new Set(ids))
        const detailBatches: string[][] = []
        for (let i = 0; i < detailIds.length; i += 50) detailBatches.push(detailIds.slice(i, i + 50))
        const details: any[] = []
        for (const batch of detailBatches) {
          if (!canSpend(1)) break
          try {
            const res: any = await withKey((yt) => yt.playlists.list({ id: batch, part: ['snippet','contentDetails'] }), { unitCost: 1, label: `playlists.list:${region}` })
            spend(1)
            details.push(...(res.data.items || []))
          } catch (e: any) {
            log('warn', `playlists.list failed region=${region}`, { error: e?.message })
          }
        }

        const playlistRows: any[] = details.map((item: any) => {
          const id = playlistUuid(item.id!)
          if (rich) return {
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
          return { id, name: item.snippet?.title || 'Untitled' }
        })
        await safeUpsertQueue('playlists', playlistRows)
        totalPlaylists += ids.length

        for (const item of details) {
          const pid = item.id as string
          const pidUuid = playlistUuid(pid)
          let pageToken: string | undefined
          let positionBase = 0
          do {
            if (!canSpend(1)) break
            try {
              const r: any = await withKey((yt) => yt.playlistItems.list({ playlistId: pid, part: ['snippet','contentDetails'], maxResults: 50, pageToken }), { unitCost: 1, label: `playlistItems.list:${region}` })
              spend(1)
              const its = r.data.items || []
              const trackRows: any[] = []
              const linkRows: any[] = []
              for (let i = 0; i < its.length; i++) {
                const it = its[i]
                const vid = it.contentDetails?.videoId
                if (!vid) continue
                const title = it.snippet?.title || 'Untitled'
                const channelTitle = it.snippet?.videoOwnerChannelTitle || it.snippet?.channelTitle || null
                const thumb = it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || null
                const tid = trackUuid(vid)
                if (rich) trackRows.push({ id: tid, external_id: vid, title, artist: channelTitle ?? null, published_at: it.contentDetails?.videoPublishedAt ?? null, thumbnail_url: thumb ?? null, updated_at: new Date().toISOString() })
                else trackRows.push({ id: tid, title })
                linkRows.push({ playlist_id: pidUuid, track_id: tid, position: positionBase + i, updated_at: new Date().toISOString() })
                totalTracks++
              }
              await safeUpsertQueue('tracks', trackRows)
              await safeUpsertQueue('playlist_tracks', linkRows)
              positionBase += its.length
              pageToken = r.data.nextPageToken || undefined
            } catch (e: any) {
              log('warn', `playlistItems.list failed for ${pid}`, { error: e?.message })
              break
            }
          } while (pageToken)
        }
      }

      const used = unitsUsed - beforeUnits
      log('info', `[SUMMARY] region=${region} playlists=${totalPlaylists} tracks=${totalTracks} used_units=${used}`)
    } catch (e: any) {
      if (e instanceof QuotaDepletedError) {
        log('warn', `[QUOTA] All API keys exhausted; switching region`)
      } else if (e?.name === 'TimeoutError') {
        log('warn', `[TIMEOUT] Region=${region} exceeded 90s, skipping`)
      } else {
        log('error', `[ERROR] Region=${region} failed`, { error: e?.message })
      }
    }
    regionsDone++
    lastRegion = region
    log('info', `[NEXT] Completed region=${region} → Next=${REGIONS[(REGIONS.indexOf(region)+1)%REGIONS.length]}`)
    await sleep(1000)
    if (unitsUsed >= budgetMax) {
      log('warn', `[BUDGET] Limit reached (${unitsUsed}/${budgetMax}), stopping discovery cycle.`)
      break
    }
  }

  log('info', `[TOTAL] Discovery summary: regions_done=${regionsDone}, playlists=${totalPlaylists}, tracks=${totalTracks}, units=${unitsUsed}`)
  return { totalPlaylists, totalTracks, totalRegionsProcessed: regionsDone, lastRegion, unitsUsed }
}
