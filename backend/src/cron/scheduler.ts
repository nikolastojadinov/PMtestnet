import cron from 'node-cron'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { log } from '../utils/logger.js'
import { fetchNewPlaylists } from '../youtube/fetchPlaylists.js'
import { refreshExistingPlaylists } from '../youtube/refreshPlaylists.js'

dotenv.config()

type Mode = 'FETCH' | 'REFRESH'

function getMode(): Mode {
  const envMode = (process.env.CRON_MODE || 'FETCH').toUpperCase()
  return envMode === 'REFRESH' ? 'REFRESH' : 'FETCH'
}

function loadPlaylistIds(): string[] {
  const file = process.env.REGIONS_FILE || process.env.REGION_MATRIX_PATH || './regions.json'
  const p = path.isAbsolute(file) ? file : path.join(process.cwd(), file)
  try {
    const raw = fs.readFileSync(p, 'utf-8')
    const data = JSON.parse(raw)
    // podržimo niz ID-eva ili objekat {playlists: []}
    if (Array.isArray(data)) return data
    if (Array.isArray(data.playlists)) return data.playlists
    return []
  } catch (e) {
    log('warn', 'Failed to read regions file, continuing with empty list', { file, error: (e as Error).message })
    return []
  }
}

export function startScheduler() {
  const mode = getMode()
  log('info', `Cron scheduler starting in mode=${mode}`)

  // svakih 3h prema zahtevima
  cron.schedule('0 */3 * * *', async () => {
    const ids = loadPlaylistIds()
    log('info', `Cron tick -> processing ${ids.length} playlists in mode=${mode}`)
    if (ids.length === 0) return
    if (mode === 'FETCH') await fetchNewPlaylists(ids)
    else await refreshExistingPlaylists(ids)
  })

  // mesečni full refresh (~30 dana)
  cron.schedule('0 0 */30 * *', async () => {
    const ids = loadPlaylistIds()
    log('info', `Monthly full refresh for ${ids.length} playlists`)
    if (ids.length === 0) return
    await refreshExistingPlaylists(ids)
  })
}

// pokrećemo scheduler i držimo proces aktivnim
startScheduler()
setInterval(() => {}, 1000 * 60 * 60)
