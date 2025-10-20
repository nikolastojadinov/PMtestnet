"use client"
import { useEffect, useState } from 'react'
import CategoryRow from '../components/CategoryRow'
import Loader from '../components/shared/Loader'
import { getPlaylistsByCategory } from '../lib/fetchPlaylists'

type Grouped = Record<string, Array<{ id: string; title: string; region?: string | null; cover_url?: string | null }>>

export default function Page() {
  const [groups, setGroups] = useState<Grouped | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let canceled = false
    ;(async () => {
      try {
        const data = await getPlaylistsByCategory()
        if (!canceled) setGroups(data)
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => { canceled = true }
  }, [])

  return (
    <div className="space-y-10">
      {/* Search */}
      <section>
        <div className="relative">
          <input
            placeholder="Search for playlists, artists, or songs"
            className="w-full rounded-full bg-white/5 border border-white/10 px-5 py-3 outline-none focus:border-[#6C2BD9] focus:shadow-[0_0_0_3px_rgba(108,43,217,0.35)] transition"
          />
        </div>
      </section>

      {loading && (
        <Loader />
      )}

      {!loading && groups && Object.keys(groups).map((title) => (
        <CategoryRow key={title} title={title} playlists={groups[title] || []} />
      ))}
    </div>
  )
}
