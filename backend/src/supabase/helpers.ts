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
  // Use a conservative column set to avoid schema mismatches.
  const row: Record<string, any> = {
    id: p.id,
    name: p.title,
    description: p.description ?? null,
    cover_url: p.thumbnail_url ?? null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('playlists').upsert(row)
  if (error) throw error
}

export async function upsertTrack(t: MinimalTrack) {
  if (!supabase) throw new Error('Supabase client not configured')
  // Use minimal columns to match most basic schemas.
  const row: Record<string, any> = {
    id: t.id,
    title: t.title,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('tracks').upsert(row)
  if (error) throw error
}

export async function linkTrackToPlaylist(playlistId: string, trackId: string, position: number) {
  if (!supabase) throw new Error('Supabase client not configured')
  const { error } = await supabase.from('playlist_tracks').upsert({
    playlist_id: playlistId,
    track_id: trackId,
    position,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
