import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { YouTubeClient } from '../youtube/client.js'
import { log } from '../utils/logger.js'
import { pingSupabase } from '../supabase/client.js'
import { fetchYouTubePlaylists, upsertPlaylistsToSupabase } from '../youtube/fetchAndUpsert.js'

dotenv.config()

function loadRegions(): Record<string, string[]> {
  const file = process.env.REGIONS_FILE || process.env.REGION_MATRIX_PATH || './regions.json'
  const p = path.isAbsolute(file) ? file : path.join(process.cwd(), file)
  try {
    const raw = fs.readFileSync(p, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return { DEFAULT: data }
    if (Array.isArray(data.playlists)) return { DEFAULT: data.playlists }
    return data
  } catch (e: any) {
    log('warn', 'regions.json not found or invalid; using defaults', { file, error: e?.message })
    return { DEFAULT: ['PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', 'PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj'] }
  }
}

async function main() {
  console.info('[INFO] Fetch cycle started (Day 1)')
  const yt = new YouTubeClient()
  // Verify Supabase connectivity
  try {
    const ok = await pingSupabase()
    if (ok) log('info', 'Supabase client connected successfully.')
  } catch (e) {
    log('warn', 'Supabase connectivity check failed')
  }
  const regions = loadRegions()
  for (const [region, ids] of Object.entries(regions)) {
    const arr = Array.isArray(ids) ? ids : []
    const fetched = await fetchYouTubePlaylists(yt, arr, 50)
    console.info(`[FETCH] region=${region} playlists=${fetched.filter(x => x.playlist).length}`)
    try {
      const stats = await upsertPlaylistsToSupabase(yt, fetched.map(f => ({ region, playlist: f.playlist })))
      console.info(`[UPSERT] inserted=${stats.inserted} updated=${stats.updated} skipped=${stats.skipped}`)
    } catch (e: any) {
      log('error', 'upsert failed for region', { region, error: e?.message })
    }
  }
  console.info('[INFO] Day 1 playlist ingestion completed successfully.')
}

main().catch((e) => {
  log('error', 'Day1 script crashed', { error: (e as Error).message })
  process.exit(1)
})
