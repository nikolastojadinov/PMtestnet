'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { getSupabaseClient } from '../../../lib/supabaseClient'

const FALLBACK_COVER = 'https://ofkfygqrfenctzitigae.supabase.co/storage/v1/object/public/Covers/IMG_0596.png'

type Playlist = {
  playlist_id: string
  title: string
  description?: string | null
  cover_url?: string | null
}

type TrackRow = {
  track_id: string
  tracks: {
    title: string | null
    artist: string | null
    duration: string | null
  }
}

export default function PlaylistPage() {
  const params = useParams<{ id: string }>()
  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [tracks, setTracks] = useState<TrackRow[]>([])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const id = params?.id
    if (id) void loadPlaylist(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.id])

  async function loadPlaylist(id: string) {
    const supabase = getSupabaseClient()
    if (!supabase) return

    const { data: playlistData, error: playlistError } = await supabase
      .from('public.v_playlists_full')
      .select('*')
      .eq('playlist_id', id)
      .single()

    if (playlistError || !playlistData) {
      setNotFound(true)
      return
    }
    setPlaylist(playlistData as Playlist)

    const { data: trackData, error: trackError } = await supabase
      .from('playlist_tracks')
      .select('track_id, tracks(title, artist, duration)')
      .eq('playlist_id', id)

    if (trackError) {
      // eslint-disable-next-line no-console
      console.error(trackError)
    } else {
      const normalized = ((trackData as any[]) || []).map((row: any) => {
        const t = Array.isArray(row.tracks) ? row.tracks[0] : row.tracks
        return {
          track_id: row.track_id as string,
          tracks: {
            title: t?.title ?? null,
            artist: t?.artist ?? null,
            duration: t?.duration ?? null,
          },
        } as TrackRow
      })
      setTracks(normalized)
    }
  }

  if (notFound) return <div className="text-white p-6">Playlist not found.</div>
  if (!playlist) return <div className="text-white p-6">Loading...</div>

  return (
    <div className="min-h-screen bg-black text-white p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={playlist.cover_url || FALLBACK_COVER}
        alt={playlist.title}
        className="w-full h-48 object-cover rounded-lg mb-4"
      />
      <h1 className="text-2xl font-bold mb-2">{playlist.title}</h1>
      <button className="px-4 py-2 bg-purple-600 rounded-lg mb-6 hover:bg-purple-700">
        ▶ Play All
      </button>

      <div>
        {tracks.length > 0 ? (
          tracks.map((item, index) => (
            <div
              key={`${item.track_id}-${index}`}
              className="flex justify-between p-3 border-b border-purple-800/40"
            >
              <span>{item.tracks.title}</span>
              <span className="text-gray-400 text-sm">{item.tracks.artist || 'Unknown'}</span>
              <span className="text-gray-500 text-xs">{item.tracks.duration || '–'}</span>
            </div>
          ))
        ) : (
          <div className="text-gray-500">No tracks found in this playlist.</div>
        )}
      </div>
    </div>
  )
}
