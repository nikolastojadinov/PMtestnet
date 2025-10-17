import { supabase } from './client.js'
import { playlistUuid, trackUuid } from '../utils/id.js'

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
  const id = playlistUuid(p.id)
  const rich = process.env.SUPABASE_RICH_SCHEMA === '1'
  if (rich) {
    const row: Record<string, any> = {
      id,
      external_id: p.id,
      name: p.title,
      description: p.description ?? null,
      cover_url: p.thumbnail_url ?? null,
      region: p.region ?? null,
      category: p.category ?? null,
      item_count: p.itemCount ?? null,
      channel_title: p.channelTitle ?? null,
      fetched_on: p.fetched_on ?? null,
      view_count: p.viewCount ?? null,
      channel_subscriber_count: p.channelSubscriberCount ?? null,
      last_etag: p.last_etag ?? null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('playlists').upsert(row)
    if (error) throw error
    return
  }
  // Minimal fallback: ensure record exists by id only
  const { error } = await supabase.from('playlists').upsert({ id })
  if (error) throw error
}

export async function upsertTrack(t: MinimalTrack) {
  if (!supabase) throw new Error('Supabase client not configured')
  const id = trackUuid(t.id)
  const rich = process.env.SUPABASE_RICH_SCHEMA === '1'
  if (rich) {
    const row: Record<string, any> = {
      id,
      external_id: t.id,
      title: t.title,
      artist: t.channelTitle ?? null,
      published_at: t.publishedAt ?? null,
      thumbnail_url: t.thumbnail_url ?? null,
      created_at: t.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('tracks').upsert(row)
    if (error) throw error
    return
  }
  // Minimal fallback: id only
  const { error } = await supabase.from('tracks').upsert({ id })
  if (error) throw error
}

export async function linkTrackToPlaylist(playlistId: string, trackId: string, position: number) {
  if (!supabase) throw new Error('Supabase client not configured')
  const pid = playlistUuid(playlistId)
  const tid = trackUuid(trackId)
  const rich = process.env.SUPABASE_RICH_SCHEMA === '1'
  if (rich) {
    const { error } = await supabase.from('playlist_tracks').upsert({
      playlist_id: pid,
      track_id: tid,
      position,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return
  }
  const { error } = await supabase.from('playlist_tracks').upsert({ playlist_id: pid, track_id: tid })
  if (error) throw error
}
