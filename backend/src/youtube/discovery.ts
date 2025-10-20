import { supabase } from '../supabase/client.js'
import { withKey } from './client.js'
import { log } from '../utils/logger.js'

// 🔹 Lokalizovane ključne reči po regionima
const REGION_KEYWORDS: Record<string, string[]> = {
  IN: ['bollywood songs', 'indian music', 'top hindi hits', 'punjabi hits', 'love songs'],
  VN: ['vietnam top music', 'nhạc trẻ', 'nhạc remix', 'vpop', 'nhạc ballad'],
  PH: ['opm hits', 'pinoy top songs', 'tagalog music', 'filipino hits'],
  KR: ['kpop hits', 'korean top songs', 'ballad', 'kdrama ost', 'kpop playlist'],
  JP: ['jpop hits', 'japanese music', 'anime songs', 'city pop', 'top jpop'],
  US: ['top music', 'billboard', 'pop hits', 'edm', 'rap'],
  RU: ['russian pop', 'русская музыка', 'топ песни', 'поп музыка'],
  default: ['top music', 'best songs', 'hits', 'edm', 'rock', 'hip hop', 'dance', 'pop', 'playlist']
}

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

// ✅ Glavna funkcija za otkrivanje playlisti po regionu
export async function discoverPlaylistsForRegion(
  region: string,
  budgetCanSpend: (cost: number) => boolean,
  budgetSpend: (cost: number) => void,
  ttlDays = 7
): Promise<RegionDiscoveryResult> {

  // 1️⃣ Cache — koristi već preuzete plejliste u poslednjih N dana
  let cached: string[] = []
  try {
    const { data, error } = await (supabase as any)
      .from('discovered_playlists')
      .select('playlist_id')
      .eq('region', region)
      .gte('fetched_on', ttlDate(ttlDays))
      .limit(100)
    if (!error) cached = (data || []).map((r: any) => r.playlist_id)
  } catch {}

  if (cached.length > 0) {
    log('info', `[CACHE] Region=${region} (${cached.length} cached playlists)`)
    return { region, playlistIds: cached, cacheHits: cached.length, newFetches: 0 }
  }

  // 2️⃣ Odabir ključnih reči
  const baseKeywords = REGION_KEYWORDS[region] || REGION_KEYWORDS.default
  const keywords = shuffle(baseKeywords)
  const found = new Set<string>()
  let newFetches = 0

  for (const q of keywords) {
    const cost = 100
    if (!budgetCanSpend(cost)) break

    try {
      const res: any = await withKey(yt =>
        yt.search.list({
          part: ['snippet'],
          type: ['playlist'],
          q,
          regionCode: region,
          videoCategoryId: '10', // 🎵 samo muzika
          relevanceLanguage: 'en',
          maxResults: 10
        }),
        { unitCost: cost, label: `search:${region}:${q}` }
      )

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

  // 3️⃣ Ukloni već postojeće plejliste iz Supabase baze
  let uniqueIds = playlistIds
  try {
    const { data: existing } = await (supabase as any)
      .from('playlists')
      .select('external_id')
      .in('external_id', playlistIds)
    const existingIds = new Set(existing?.map((r: any) => r.external_id))
    uniqueIds = playlistIds.filter(id => !existingIds.has(id))
  } catch (e: any) {
    log('warn', `[FILTER] Failed to check existing playlists`, { error: e?.message })
  }

  // 4️⃣ Upsert novih playlisti u cache
  if (uniqueIds.length > 0) {
    const nowIso = new Date().toISOString()
    const rows = uniqueIds.map(pid => ({ playlist_id: pid, region, fetched_on: nowIso }))
    try {
      await (supabase as any).from('discovered_playlists').upsert(rows, { onConflict: 'playlist_id' })
    } catch (e: any) {
      log('warn', `[UPSERT] Fallback for discovered_playlists`, { error: e?.message })
      try {
        const fallbackRows = uniqueIds.map(pid => ({ playlist_id: pid, region, discovered_at: nowIso }))
        await (supabase as any).from('discovered_playlists').upsert(fallbackRows, { onConflict: 'playlist_id' })
      } catch {}
    }
  }

  log('info', `[DISCOVERY] Region=${region} new=${uniqueIds.length} cacheHits=${cached.length}`)
  return { region, playlistIds: uniqueIds, cacheHits: cached.length, newFetches }
}
