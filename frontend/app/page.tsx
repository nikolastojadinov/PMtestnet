import PlaylistRow from '@/components/PlaylistRow'
import SearchBar from '@/components/SearchBar'
import getSupabase from '../lib/supabaseClient'

type Playlist = { id: string; title: string; region: string | null; cover_url: string | null; category: string | null }

export default async function Page() {
  const categories = ['Most popular', 'Trending now', 'Best of 80s', 'Best of 90s', 'Best of 2000'] as const

  const supabase = getSupabase()
  const playlistsByCategory: Record<string, Playlist[]> = {}

  if (supabase) {
    for (const cat of categories) {
      const { data } = await supabase
        .from('playlists')
        .select('id, title, name, region, category, cover_url')
        .eq('is_public', true)
        .eq('category', cat)
        .limit(8)
      playlistsByCategory[cat] = (data || []).map((r: any) => ({
        id: r.id,
        title: r.title || r.name || 'Untitled',
        region: r.region ?? null,
        category: r.category ?? null,
        cover_url: r.cover_url ?? null,
      }))
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
