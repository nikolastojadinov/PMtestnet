import fs from 'node:fs'
import path from 'node:path'
import { supabase } from '../supabase/client.js'
import { log } from '../utils/logger.js'

async function loadFromEnv(): Promise<string[] | null> {
  const raw = process.env.PLAYLIST_IDS
  if (!raw) return null
  try {
    // Try JSON array first
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.filter(Boolean)
  } catch {}
  // Fallback: comma/whitespace-separated string
  return raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
}

async function loadFromUrl(): Promise<string[] | null> {
  const url = process.env.PLAYLISTS_URL
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (Array.isArray(data)) return data.filter(Boolean)
    if (Array.isArray((data as any).playlists)) return (data as any).playlists.filter(Boolean)
    return null
  } catch (e: any) {
    log('warn', 'Failed to load playlist IDs from URL', { url, error: e?.message })
    return null
  }
}

async function loadFromSupabase(): Promise<string[] | null> {
  try {
    if (!supabase) return null
    const table = process.env.PLAYLISTS_TABLE || 'source_playlists'
    // Try to select multiple possible column names to be flexible
    const { data, error } = await (supabase
      .from(table)
      .select('*') as any)
    if (error) {
      log('warn', 'Supabase playlists fetch failed', { table, error: error.message })
      return null
    }
    if (!Array.isArray(data)) return null
    const ids = data.map((row: any) => row.external_id || row.youtube_id || row.playlist_id || row.id)
      .filter(Boolean)
    const enabledFiltered = data.filter((row: any) => row.enabled === true || row.enabled == null)
      .map((row: any) => row.external_id || row.youtube_id || row.playlist_id || row.id)
      .filter(Boolean)
    return (enabledFiltered.length > 0 ? enabledFiltered : ids)
  } catch (e) {
    return null
  }
}

function loadFromFile(): string[] | null {
  const file = process.env.REGIONS_FILE || process.env.REGION_MATRIX_PATH || './regions.json'
  const p = path.isAbsolute(file) ? file : path.join(process.cwd(), file)
  try {
    const raw = fs.readFileSync(p, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data.filter(Boolean)
    if (Array.isArray(data.playlists)) return data.playlists.filter(Boolean)
    return []
  } catch {
    return []
  }
}

export async function loadPlaylistIds(): Promise<{ ids: string[]; source: string } > {
  const fromEnv = await loadFromEnv()
  if (fromEnv && fromEnv.length) return { ids: fromEnv, source: 'env:PLAYLIST_IDS' }

  const fromUrl = await loadFromUrl()
  if (fromUrl && fromUrl.length) return { ids: fromUrl, source: 'url:PLAYLISTS_URL' }

  if ((process.env.PLAYLIST_SOURCE || '').toLowerCase() === 'supabase' || process.env.PLAYLISTS_TABLE) {
    const fromSb = await loadFromSupabase()
    if (fromSb && fromSb.length) return { ids: fromSb, source: 'supabase' }
  }

  const fromFile = loadFromFile() || []
  return { ids: fromFile, source: 'file:regions.json' }
}
