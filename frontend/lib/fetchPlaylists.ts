import getSupabase from './supabaseClient'

export type PlaylistRow = {
  id: string
  title: string
  region: string | null
  cover_url: string | null
  category: string | null
}

const CATEGORY_ORDER = [
  'Most popular',
  'Trending now',
  'Best of 80s',
  'Best of 90s',
  'Best of 2000s'
] as const

export async function getPlaylistsByCategory(region?: string): Promise<Record<string, PlaylistRow[]>> {
  // Flexible column names: name/title; region/category may be null
  const supabase = getSupabase()
  if (!supabase) return {}
  let query = supabase
    .from('playlists')
    .select('id, name, title, region, category, cover_url, is_public')
    .eq('is_public', true)
    .limit(200)

  if (region) query = query.eq('region', region)

  const { data, error } = await query
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[supabase] playlists fetch error:', error.message)
    return {}
  }

  const rows: PlaylistRow[] = (data || []).map((r: any) => ({
    id: r.id,
    title: r.title || r.name || 'Untitled',
    region: r.region ?? null,
    cover_url: r.cover_url ?? null,
    category: r.category ?? null,
  }))

  const grouped: Record<string, PlaylistRow[]> = {}
  for (const key of CATEGORY_ORDER) grouped[key] = []
  for (const r of rows) {
    const cat = (r.category || 'Trending now') as (typeof CATEGORY_ORDER)[number] | string
    if (!grouped[cat]) grouped[cat] = []
    if (grouped[cat].length < 8) grouped[cat].push(r)
  }
  return grouped
}
