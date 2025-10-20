import { createClient } from '@supabase/supabase-js'

const FALLBACK_COVER =
  'https://ofkfygqrfenctzitigae.supabase.co/storage/v1/object/public/Covers/IMG_0596.png'

// SSR – uvek sveže iz baze
export const revalidate = 0

type Playlist = {
  playlist_id: string
  title: string
  description?: string | null
  cover_url?: string | null
  item_count?: number | null
  created_at?: string | null
}

async function fetchPlaylists(): Promise<Record<string, Playlist[]>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.from('public.v_playlists_full').select('*')

  if (error || !data) {
    console.error('[SUPABASE ERROR]', error)
    return {}
  }

  const mapped: Record<string, Playlist[]> = {
    'Most Popular': [],
    'Trending Now': [],
    'Best of 80s': [],
    'Best of 90s': [],
    'Best of 2000': [],
  }

  for (const item of data as Playlist[]) {
    const title = (item.title || '').toLowerCase()
    if (title.includes('80')) mapped['Best of 80s'].push(item)
    else if (title.includes('90')) mapped['Best of 90s'].push(item)
    else if (title.includes('2000')) mapped['Best of 2000'].push(item)
    else if (title.includes('trend')) mapped['Trending Now'].push(item)
    else mapped['Most Popular'].push(item)
  }

  return mapped
}

export default async function HomePage() {
  const categories = await fetchPlaylists()

  if (!categories || Object.keys(categories).length === 0) {
    return (
      <div className="min-h-screen bg-black text-purple-300 flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold mb-4">Purple Music</h1>
        <p>Loading playlists...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-5">
      <h1 className="text-2xl font-bold text-purple-400 mb-6">Purple Music</h1>

      <div className="w-full mb-6">
        <input
          type="text"
          placeholder="Search for playlists, artists, or songs"
          className="w-full p-3 rounded-xl bg-purple-900/30 border border-purple-700 focus:outline-none text-purple-100"
        />
      </div>

      {Object.entries(categories).map(([cat, list]) => (
        <div key={cat} className="mb-8">
          <h2 className="text-xl font-semibold mb-3">{cat}</h2>
          <div className="flex overflow-x-auto gap-4">
            {list.length > 0 ? (
              list.map((playlist) => (
                <a
                  key={playlist.playlist_id}
                  href={`/playlist/${playlist.playlist_id}`}
                  className="flex-shrink-0 w-40 p-2 bg-purple-800/20 rounded-lg hover:bg-purple-700/40 transition"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={playlist.cover_url || FALLBACK_COVER}
                    alt={playlist.title}
                    className="w-full h-24 object-cover rounded-md mb-2"
                  />
                  <div className="text-sm text-white truncate">{playlist.title}</div>
                </a>
              ))
            ) : (
              <div className="text-gray-500 text-sm">No playlists</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
