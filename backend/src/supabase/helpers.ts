import { supabase } from './client.js'

export type MinimalPlaylist = {
  id: string
  title: string
  description?: string | null
  thumbnail_url?: string | null
  region?: string | null
  category?: string | null
  is_public?: boolean
  itemCount?: number | null
  channelTitle?: string | null
  fetched_on?: string | null
  viewCount?: number | null
  channelSubscriberCount?: number | null
  created_at?: string | null
  last_etag?: string | null
}

export type MinimalTrack = {
  id: string // YouTube videoId
  title: string
  channelTitle?: string | null
  publishedAt?: string | null
  thumbnail_url?: string | null
  created_at?: string | null
}

export async function upsertPlaylist(p: MinimalPlaylist) {
  if (!supabase) throw new Error('Supabase client not configured')
  // Ultra-conservative: only ensure the record exists by id
  const { error } = await supabase.from('playlists').upsert({ id: p.id })
  if (error) throw error
}

export async function upsertTrack(t: MinimalTrack) {
  if (!supabase) throw new Error('Supabase client not configured')
  // Ultra-conservative: only ensure the record exists by id
  const { error } = await supabase.from('tracks').upsert({ id: t.id })
  if (error) throw error
}

export async function linkTrackToPlaylist(playlistId: string, trackId: string, position: number) {
  if (!supabase) throw new Error('Supabase client not configured')
  // Minimal link payload; omit columns that may not exist (position/updated_at)
  const { error } = await supabase.from('playlist_tracks').upsert({
    playlist_id: playlistId,
    track_id: trackId,
  })
  if (error) throw error
}
