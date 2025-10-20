'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabaseClient'

type Playlist = {
  id: string
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

  useEffect(() => {
    fetchCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchCategories() {
    setLoading(true)
    try {
      const supabase = getSupabaseClient()
      if (!supabase) {
        setCategories({})
        setLoading(false)
        return
      }
      const [popularRes, trendingRes, eightiesRes, ninetiesRes, twoThousandsRes] = await Promise.all([
        supabase
          .from('v_playlists_full')
          .select('*')
          .gt('item_count', 0)
          .order('item_count', { ascending: false })
          .limit(20),
        supabase
          .from('v_playlists_full')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('v_playlists_full')
          .select('*')
          .or('title.ilike.%80s%,description.ilike.%80s%')
          .limit(20),
        supabase
          .from('v_playlists_full')
          .select('*')
          .or('title.ilike.%90s%,description.ilike.%90s%')
          .limit(20),
        supabase
          .from('v_playlists_full')
          .select('*')
          .or('title.ilike.%2000%,title.ilike.%2000s%,title.ilike.%00s%,description.ilike.%2000%,description.ilike.%2000s%,description.ilike.%00s%')
          .limit(20)
      ])

      const mapped: Record<string, Playlist[]> = {
        'Most Popular': (popularRes.data as Playlist[]) || [],
        'Trending Now': (trendingRes.data as Playlist[]) || [],
        'Best of 80s': (eightiesRes.data as Playlist[]) || [],
        'Best of 90s': (ninetiesRes.data as Playlist[]) || [],
        'Best of 2000': (twoThousandsRes.data as Playlist[]) || []
      }

      setCategories(mapped)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

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
      .limit(50)

    if (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    } else {
      setResults((data as Playlist[]) || [])
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <h1 className="text-2xl font-bold text-purple-400 mb-6">Purple Music</h1>

      <input
        type="text"
        value={search}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search for playlists, artists, or songs"
        className="w-full p-3 rounded-xl bg-purple-900/30 border border-purple-700 focus:outline-none text-purple-100 mb-6"
      />

      {search && results.length > 0 && (
        <div>
          {results.map((playlist) => (
            <a
              key={playlist.id}
              href={`/playlist/${playlist.id}`}
              className="block mb-3 p-3 rounded-lg bg-purple-800/30 hover:bg-purple-700/40 transition"
            >
              <div className="font-semibold">{playlist.title}</div>
              <div className="text-sm text-gray-400">
                {playlist.description || 'No description'}
              </div>
            </a>
          ))}
        </div>
      )}

      {!search && (
        <div>
          {loading && <div className="text-gray-400">Loading…</div>}
          {!loading && Object.keys(categories).map((cat) => (
            <div key={cat} className="mb-8">
              <h2 className="text-xl font-semibold mb-3">{cat}</h2>
              <div className="flex overflow-x-auto gap-4">
                {categories[cat].length > 0 ? (
                  categories[cat].map((playlist) => (
                    <a
                      key={playlist.id}
                      href={`/playlist/${playlist.id}`}
                      className="flex-shrink-0 w-40 p-2 bg-purple-800/20 rounded-lg hover:bg-purple-700/40 transition"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={playlist.cover_url || '/placeholder.png'}
                        alt={playlist.title}
                        className="w-full h-24 object-cover rounded-md mb-2"
                      />
                      <div className="text-sm text-white line-clamp-2">{playlist.title}</div>
                    </a>
                  ))
                ) : (
                  <div className="text-gray-500 text-sm">No playlists</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

