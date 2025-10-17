import cron from 'node-cron'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import http from 'node:http'
import { log } from '../utils/logger.js'
import { startHttpServer } from '../server/http.js'
import { fetchNewPlaylists } from '../youtube/fetchPlaylists.js'
import { refreshExistingPlaylists } from '../youtube/refreshPlaylists.js'

dotenv.config()
// Ensure Render sees an open port (keep-alive)
startHttpServer()

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

async function runOnce() {
  const mode = getMode()
  const ids = loadPlaylistIds()
  log('info', `Initial run (${mode}) -> processing ${ids.length} playlists`)

  if (ids.length === 0) {
    log('warn', 'No playlists found in regions.json — skipping initial fetch')
    return
  }

  try {
    if (mode === 'FETCH') await fetchNewPlaylists(ids)
    else await refreshExistingPlaylists(ids)
    log('info', 'Initial fetch/refresh cycle completed successfully ✅')
  } catch (err) {
    log('error', 'Initial run failed', { error: (err as Error).message })
  }
}

export function startScheduler() {
  const mode = getMode()
  log('info', `Cron scheduler starting in mode=${mode}`)

  // 🔹 Pokreni odmah po startu (deploy)
  runOnce()

  // 🔹 Zakaži ciklus svakih 3 sata
  cron.schedule('0 */3 * * *', async () => {
    const ids = loadPlaylistIds()
    log('info', `Cron tick -> processing ${ids.length} playlists in mode=${mode}`)
    if (ids.length === 0) return
    if (mode === 'FETCH') await fetchNewPlaylists(ids)
    else await refreshExistingPlaylists(ids)
  })

  // 🔹 Mesečni full refresh (~30 dana)
  cron.schedule('0 0 */30 * *', async () => {
    const ids = loadPlaylistIds()
    log('info', `Monthly full refresh for ${ids.length} playlists`)
    if (ids.length === 0) return
    await refreshExistingPlaylists(ids)
  })
}

// When this file is executed directly (Render start command), start immediately
try {
  startScheduler()
  // 🔹 Samopinging svakih 4 minuta da Render ne uspava proces
  const PORT = process.env.PORT || 8080
  setInterval(() => {
    try {
      http.get(`http://localhost:${PORT}/health`, res => res.resume())
    } catch {}
  }, 4 * 60 * 1000)
} catch {}
