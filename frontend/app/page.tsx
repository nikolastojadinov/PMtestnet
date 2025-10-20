'use client'

import { useEffect, useState } from 'react'
import { getSupabaseClient } from '../lib/supabaseClient'

const FALLBACK_COVER = 'https://ofkfygqrfenctzitigae.supabase.co/storage/v1/object/public/Covers/IMG_0596.png'

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

  useEffect(() => {
    void loadCategories()
  }, [])

  async function loadCategories() {
    const supabase = getSupabaseClient()
    if (!supabase) return

    const { data, error } = await supabase.from('public.v_playlists_full').select('*')
    if (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      return
    }

    const mapped: Record<string, Playlist[]> = {
      'Most Popular': [],
      'Trending Now': [],
      'Best of 80s': [],
      'Best of 90s': [],
      'Best of 2000': [],
    }

    for (const item of (data as Playlist[])) {
      const title = (item.title || '').toLowerCase()
      if (title.includes('80')) mapped['Best of 80s'].push(item)
      else if (title.includes('90')) mapped['Best of 90s'].push(item)
      else if (title.includes('2000')) mapped['Best of 2000'].push(item)
      else if (title.includes('trend')) mapped['Trending Now'].push(item)
      else mapped['Most Popular'].push(item)
    }
    setCategories(mapped)
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
      .from('public.v_playlists_full')
      .select('*')
      .or(`title.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(25)

    if (error) {
      // eslint-disable-next-line no-console
      console.error(error)
    } else {
      setResults((data as Playlist[]) || [])
    }
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
        ))
      )}
    </div>
  )
}

