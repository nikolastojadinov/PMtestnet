import { supabase } from './client.js'

export type MinimalPlaylist = {
  id: string
  title: string
  description?: string | null
  thumbnail_url?: string | null
}

export type MinimalTrack = {
  id: string // YouTube videoId
  title: string
  channelTitle?: string | null
  publishedAt?: string | null
  thumbnail_url?: string | null
}

export async function upsertPlaylist(p: MinimalPlaylist) {
  if (!supabase) throw new Error('Supabase client not configured')
  const { error } = await supabase.from('playlists').upsert({
    id: p.id,
    name: p.title,
    description: p.description ?? null,
    cover_url: p.thumbnail_url ?? null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function upsertTrack(t: MinimalTrack) {
  if (!supabase) throw new Error('Supabase client not configured')
  const { error } = await supabase.from('tracks').upsert({
    id: t.id,
    title: t.title,
    artist: t.channelTitle ?? null,
    published_at: t.publishedAt ?? null,
    thumbnail_url: t.thumbnail_url ?? null,
    updated_at: new Date().toISOString(),
  })
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
