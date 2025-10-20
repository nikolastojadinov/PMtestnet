import PlaylistRow from '@/components/PlaylistRow'
import SearchBar from '@/components/SearchBar'
import { createClient } from '@supabase/supabase-js'
import type { Playlist } from '@/types/playlist'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const categories = [
    { title: 'Most popular' as const },
    { title: 'Trending now' as const },
    { title: 'Best of 80s' as const },
    { title: 'Best of 90s' as const },
    { title: 'Best of 2000' as const },
  ]

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = url && anon ? createClient(url, anon) : null
  const playlistsByCategory: Record<string, Playlist[]> = {}

  if (supabase) {
    for (const cat of categories) {
      let query = supabase
        .from('playlists')
        .select('id, external_id, title, name, description, cover_url, region, category, item_count, channel_title, created_at')
        .eq('is_public', true)

      switch (cat.title) {
        case 'Most popular':
          // Higher item_count first
          query = query.gt('item_count', 30).order('item_count', { ascending: false })
          break
        case 'Trending now':
          // Newest first
          query = query.order('created_at', { ascending: false, nullsFirst: false })
          break
        case 'Best of 80s':
          query = query.ilike('title', '%80s%')
          break
        case 'Best of 90s':
          query = query.ilike('title', '%90s%')
          break
        case 'Best of 2000':
          query = query.ilike('title', '%2000%')
          break
      }

      const { data } = await query.limit(8)
      playlistsByCategory[cat.title] = (data || []).map((r: any) => ({
        id: r.id,
        external_id: r.external_id ?? null,
        title: r.title || r.name || 'Untitled',
        description: r.description ?? null,
        cover_url: r.cover_url ?? null,
        region: r.region ?? null,
        category: r.category ?? null,
        item_count: r.item_count ?? null,
        channel_title: r.channel_title ?? null,
        created_at: r.created_at ?? null,
      })) as Playlist[]
    }
  } else {
    for (const { title } of categories) playlistsByCategory[title] = []
  }

  return (
    <main className="min-h-screen bg-[#120016] text-white px-4 pb-20 space-y-8">
      <SearchBar />
      {categories.map(({ title }) => (
        <PlaylistRow key={title} title={title} playlists={playlistsByCategory[title] || []} />
      ))}
    </main>
  )
}
