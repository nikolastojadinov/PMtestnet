import PlaylistRow from '@/components/PlaylistRow'
import SearchBar from '@/components/SearchBar'
import getSupabase from '../lib/supabaseClient'
import type { Playlist } from '@/types/playlist'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const categories = ['Most popular', 'Trending now', 'Best of 80s', 'Best of 90s', 'Best of 2000'] as const

  const supabase = getSupabase()
  const playlistsByCategory: Record<string, Playlist[]> = {}

  if (supabase) {
    for (const cat of categories) {
      const { data } = await supabase
        .from('playlists')
        .select('id, external_id, title, name, description, cover_url, region, category, item_count, channel_title, created_at')
        .eq('is_public', true)
        .eq('category', cat)
        .limit(8)
      playlistsByCategory[cat] = (data || []).map((r: any) => ({
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
    for (const cat of categories) playlistsByCategory[cat] = []
  }

  return (
    <main className="min-h-screen bg-[#120016] text-white px-4 pb-20 space-y-8">
      <SearchBar />
      {categories.map((cat) => (
        <PlaylistRow key={cat} title={cat} playlists={playlistsByCategory[cat] || []} />
      ))}
    </main>
  )
}
