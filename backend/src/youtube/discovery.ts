import { supabase } from '../supabase/client.js'
import { withKey, QuotaDepletedError } from './client.js'
import { log } from '../utils/logger.js'

const REGION_KEYWORDS: Record<string, string[]> = {
  IN: ['bollywood songs', 'indian music', 'top hindi hits', 'punjabi hits', 'love songs'],
  VN: ['vietnam top music', 'nhạc trẻ', 'nhạc remix', 'vpop', 'nhạc ballad'],
  PH: ['opm hits', 'pinoy top songs', 'tagalog music', 'filipino hits'],
  KR: ['kpop hits', 'kpop playlist', 'ballad', 'kdrama ost', 'korean pop'],
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

export async function discoverPlaylistsForRegion(
  region: string,
  budgetCanSpend: (cost: number) => boolean,
  budgetSpend: (cost: number) => void,
  ttlDays = 7
): Promise<RegionDiscoveryResult> {

  // 1️⃣ Cache check
  let cached: string[] = []
  try {
    const { data } = await (supabase as any)
      .from('discovered_playlists')
      .select('playlist_id')
      .eq('region', region)
      .gte('fetched_on', ttlDate(ttlDays))
      .limit(100)
    cached = (data || []).map((r: any) => r.playlist_id)
  } catch {}

  if (cached.length > 0) {
    log('info', `[CACHE] Region=${region} (${cached.length} cached playlists)`)
    return { region, playlistIds: cached, cacheHits: cached.length, newFetches: 0 }
  }

  // 2️⃣ Discover fresh playlists
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
          videoCategoryId: '10',
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
      // 🧠 NOVO: Ako su svi API ključevi iscrpljeni — čekaj 1h i probaj ponovo
      if (e instanceof QuotaDepletedError) {
        log('warn', `[WAIT] All API keys exhausted. Cooling down for 60 minutes before continuing...`)
        await new Promise(res => setTimeout(res, 60 * 60 * 1000))
        return await discoverPlaylistsForRegion(region, budgetCanSpend, budgetSpend, ttlDays)
      }
      log('warn', `[SEARCH] region=${region} q="${q}" failed`, { error: e?.message })
    }
  }

  const playlistIds = Array.from(found)

  // 3️⃣ Remove already existing playlists
  let uniqueIds = playlistIds
  try {
    const { data: existing } = await (supabase as any)
      .from('playlists')
      .select('external_id')
      .in('external_id', playlistIds)
    const existingIds = new Set(existing?.map((r: any) => r.external_id))
    uniqueIds = playlistIds.filter(id => !existingIds.has(id))
  } catch {}

  // 4️⃣ Upsert new ones into cache
  if (uniqueIds.length > 0) {
    const nowIso = new Date().toISOString()
    const rows = uniqueIds.map(pid => ({ playlist_id: pid, region, fetched_on: nowIso }))
    try {
      await (supabase as any).from('discovered_playlists').upsert(rows, { onConflict: 'playlist_id' })
    } catch {}
  }

  log('info', `[DISCOVERY] Region=${region} new=${uniqueIds.length} cacheHits=${cached.length}`)
  return { region, playlistIds: uniqueIds, cacheHits: cached.length, newFetches }
}
