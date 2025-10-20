'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabaseClient'

const FALLBACK_COVER =
  'https://ofkfygqrfenctzitigae.supabase.co/storage/v1/object/public/Covers/IMG_0596.png'

type Playlist = {
  playlist_id: string
  title: string
  description?: string | null
  cover_url?: string | null
  item_count?: number | null
  created_at?: string | null
}

export default function HomePage() {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Playlist[]>([])
  const [categories, setCategories] = useState<Record<string, Playlist[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadCategories()
  }, [])

  async function loadCategories() {
    console.log('[Frontend] Loading playlists from Supabase...')
    const supabase = getSupabaseClient()
    if (!supabase) {
      setError('Supabase client not initialized')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase.from('v_playlists_full').select('*').limit(100)
      if (error) {
        console.error('[Supabase Error]', error)
        setError(error.message)
      } else if (!data || data.length === 0) {
        console.warn('[Frontend] No playlists returned from Supabase.')
        setError('No playlists found.')
      } else {
        console.log('[Frontend] Received playlists:', data.length)
        console.log('[Sample playlist]', data[0])
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

        setCategories(mapped)
      }
    } catch (e: any) {
      console.error('[Frontend Exception]', e)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col justify-center items-center text-purple-300">
        <h1 className="text-3xl font-bold mb-2">Purple Music</h1>
        <p>Loading playlists...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-red-400 flex flex-col justify-center items-center">
        <h1 className="text-3xl font-bold mb-4">Purple Music</h1>
        <p>{error}</p>
        <p className="mt-4 text-sm text-gray-400">(Check browser console for logs)</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-5">
      <h1 className="text-2xl font-bold text-purple-400 mb-6">Purple Music</h1>

      <input
        type="text"
        value={search}
        onChange={(e) => void handleSearch(e.target.value)}
        placeholder="Search for playlists, artists, or songs"
        className="w-full p-3 rounded-xl bg-purple-900/30 border border-purple-700 focus:outline-none text-purple-100 mb-6"
      />

      {results.length > 0 ? (
        <div>
          {results.map((playlist) => (
            <a
              key={playlist.playlist_id}
              href={`/playlist/${playlist.playlist_id}`}
              className="block mb-3 p-3 rounded-lg bg-purple-800/30 hover:bg-purple-700/40 transition"
            >
              <div className="font-semibold">{playlist.title}</div>
              <div className="text-sm text-gray-400">{playlist.description || 'No description'}</div>
            </a>
          ))}
        </div>
      ) : (
        Object.entries(categories).map(([cat, list]) => (
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
        ))
      )}
    </div>
  )

  async function handleSearch(value: string) {
    setSearch(value)
    const q = value.trim()
    if (q.length === 0) {
      setResults([])
      return
    }
    const supabase = getSupabaseClient()
    if (!supabase) return

    const { data, error } = await supabase
      .from('v_playlists_full')
      .select('*')
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(25)

    if (error) console.error('[Search Error]', error)
    else setResults((data as Playlist[]) || [])
  }
}
