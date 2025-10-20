"use client"
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import getSupabase from '../lib/supabaseClient'

type Row = { id: string; title?: string | null; name?: string | null }

export default function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Row[]>([])
  const supabase = useMemo(() => getSupabase(), [])

  useEffect(() => {
    const ctrl = new AbortController()
    const run = async () => {
      if (!supabase || !query.trim()) { setResults([]); return }
      // Simple debounce
      await new Promise((r) => setTimeout(r, 200))
      if (ctrl.signal.aborted) return
      try {
        const { data, error } = await supabase
          .from('playlists')
          .select('id, title, name')
          .ilike('title', `%${query}%`)
          .limit(10)
        if (error) {
          console.warn('[search] playlists error:', error.message)
          setResults([])
          return
        }
        setResults(data || [])
      } catch (e: any) {
        console.warn('[search] unexpected:', e?.message)
      }
    }
    run()
    return () => ctrl.abort()
  }, [query, supabase])

  return (
    <div className="w-full mt-6 mb-2">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for playlists, artists, or songs"
        className="w-full rounded-full bg-[#1d0224] border border-purple-500/40 text-gray-200 px-5 py-3 outline-none focus:border-purple-400 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.25)] transition"
      />
      {results.length > 0 && (
        <div className="mt-3 bg-[#1a0121] rounded-xl p-2 shadow-lg divide-y divide-white/5 border border-white/10">
          {results.map((r) => (
            <Link key={r.id} href={`/playlist/${r.id}`} className="block p-2 hover:bg-[#290234] rounded">
              {(r.title || r.name) ?? 'Untitled'}
            </Link>
          ))}
        </div>
      )}
    </div>
  )}
