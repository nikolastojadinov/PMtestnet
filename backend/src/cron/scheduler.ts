import cron from 'node-cron'
import dotenv from 'dotenv'
import http from 'node:http'
import { log } from '../utils/logger.js'
import { startHttpServer } from '../server/http.js'
import { fetchNewPlaylists } from '../youtube/fetchPlaylists.js'
import { refreshExistingPlaylists } from '../youtube/refreshPlaylists.js'
import { loadPlaylistIds as loadIds } from '../config/playlistSource.js'
import { ingestInit } from '../state/ingestState.js'

dotenv.config()
// Ensure Render sees an open port (keep-alive)
startHttpServer()

type Mode = 'FETCH' | 'REFRESH'

function getMode(): Mode {
  const envMode = (process.env.CRON_MODE || 'FETCH').toUpperCase()
  return envMode === 'REFRESH' ? 'REFRESH' : 'FETCH'
}

async function loadPlaylistIds(): Promise<{ ids: string[]; source: string }> {
  const { ids, source } = await loadIds()
  return { ids, source }
}

async function runOnce() {
  const mode = getMode()
  const { ids, source } = await loadPlaylistIds()
  log('info', `Initial run (${mode}) -> processing ${ids.length} playlists (source=${source})`)

  if (ids.length === 0) {
    log('warn', 'No playlists found in regions.json — skipping initial fetch')
    return
  }

  try {
  // inicijalizuj state sa realnim izvorom
  ingestInit(mode, source, ids)
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
    const { ids, source } = await loadPlaylistIds()
    log('info', `Cron tick -> processing ${ids.length} playlists (source=${source}) in mode=${mode}`)
    if (ids.length === 0) return
    if (mode === 'FETCH') await fetchNewPlaylists(ids)
    else await refreshExistingPlaylists(ids)
  })

  // 🔹 Mesečni full refresh (~30 dana)
  cron.schedule('0 0 */30 * *', async () => {
    const { ids, source } = await loadPlaylistIds()
    log('info', `Monthly full refresh for ${ids.length} playlists (source=${source})`)
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
