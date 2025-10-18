import { supabase } from '../supabase/client.js'
import { withKey } from './client.js'
import { log } from '../utils/logger.js'

const KEYWORDS = [
  'top music', 'hits', 'best songs', 'pop', 'rock',
  'edm', 'hip hop', 'dance', 'acoustic', 'playlist'
]

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function ttlDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export type RegionDiscoveryResult = {
  region: string
  playlistIds: string[]
  cacheHits: number
  newFetches: number
}

export async function discoverPlaylistsForRegion(region: string, budgetCanSpend: (cost: number) => boolean, budgetSpend: (cost: number) => void, ttlDays = 7): Promise<RegionDiscoveryResult> {
  // 1) Try cache first (entries newer than TTL)
  let cached: string[] = []
  try {
    const { data, error } = await (supabase as any)
      .from('discovered_playlists')
      .select('playlist_id,fetched_on,discovered_at')
      .eq('region', region)
      .gte('fetched_on', ttlDate(ttlDays))
      .limit(100)
    if (!error) {
      cached = (data || []).map((r: any) => r.playlist_id)
    } else {
      // Fallback: try discovered_at column if fetched_on missing
      const { data: data2 } = await (supabase as any)
        .from('discovered_playlists')
        .select('playlist_id,discovered_at')
        .eq('region', region)
        .gte('discovered_at', ttlDate(ttlDays))
        .limit(100)
      cached = (data2 || []).map((r: any) => r.playlist_id)
    }
  } catch {}

  if (cached.length > 0) {
    log('info', `[CACHE] Region=${region} served from cache (${cached.length} ids)`) 
    return { region, playlistIds: Array.from(new Set(cached)), cacheHits: cached.length, newFetches: 0 }
  }

  // 2) Cache expired or empty → Minimal search across shuffled keywords
  const keywords = shuffle(KEYWORDS)
  const found = new Set<string>()
  let newFetches = 0

  for (const q of keywords) {
    // search.list estimated cost ~100 units
    const cost = 100
    if (!budgetCanSpend(cost)) { break }
    try {
      const res: any = await withKey((yt) => yt.search.list({
        part: ['snippet'],
        type: ['playlist'],
        q,
        regionCode: region,
        relevanceLanguage: 'en',
        maxResults: 5,
      }), { unitCost: cost, label: `search:${region}:${q}` })
      const items = res.data.items || []
      for (const it of items) {
        const pid = it.id?.playlistId
        if (pid) found.add(pid)
      }
      budgetSpend(cost)
      newFetches++
    } catch (e: any) {
      log('warn', `[SEARCH] region=${region} q="${q}" failed`, { error: e?.message })
    }
  }

  const playlistIds = Array.from(found)
  // 3) Upsert to cache with fetched_on timestamp
  if (playlistIds.length > 0) {
    const nowIso = new Date().toISOString()
    const rows = playlistIds.map(pid => ({ playlist_id: pid, region, fetched_on: nowIso }))
    try {
      await (supabase as any).from('discovered_playlists').upsert(rows, { onConflict: 'playlist_id' })
    } catch (e: any) {
      // Fallback for schemas without fetched_on column
      try {
        const fallbackRows = playlistIds.map(pid => ({ playlist_id: pid, region, discovered_at: nowIso }))
        await (supabase as any).from('discovered_playlists').upsert(fallbackRows, { onConflict: 'playlist_id' })
      } catch {}
    }
  }

  return { region, playlistIds, cacheHits: 0, newFetches }
}
