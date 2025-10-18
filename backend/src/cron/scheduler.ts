import cron from 'node-cron'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { log } from '../utils/logger.js'
import { startHttpServer } from '../server/http.js'
import { fetchNewPlaylists } from '../youtube/fetchNewPlaylists.js'
import { refreshExistingPlaylists } from '../youtube/refreshExistingPlaylists.js'

dotenv.config()
// ensure Render detects open port
try { startHttpServer() } catch {}

function getCycleMode(): 'FETCH' | 'REFRESH' {
  const start = process.env.CYCLE_START_DATE ? new Date(process.env.CYCLE_START_DATE) : new Date('2025-10-17T00:00:00Z')
  const now = new Date()
  const daysPassed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  const mode = (daysPassed % 31 === 30) ? 'REFRESH' : 'FETCH'
  return mode
}

function loadPlaylistIds(): string[] {
  const file = process.env.REGIONS_FILE || process.env.REGION_MATRIX_PATH || './regions.json'
  const p = path.isAbsolute(file) ? file : path.join(process.cwd(), file)
  try {
    const raw = fs.readFileSync(p, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data
    if (Array.isArray(data.playlists)) return data.playlists
    return []
  } catch (e) {
    log('warn', 'Failed to read regions file, continuing with empty list', { file, error: (e as Error).message })
    return []
  }
}

export async function startScheduler() {
  let mode = getCycleMode()
  log('info', `Cron scheduler starting in mode=${mode}`)

  // kick off immediately once on start
  ;(async () => {
    try {
      const ids = loadPlaylistIds()
      log('info', `[INIT] tick -> ${ids.length} playlists in mode=${mode}`)
      if (mode === 'FETCH') {
        if (ids.length < 5) {
          log('info', '[DISCOVERY] Starting global region discovery mode')
          const count = await fetchNewPlaylists()
          log('info', `[DISCOVERY] Completed with ${count} playlists`)
        } else {
          await fetchNewPlaylists(ids)
        }
      } else {
        if (ids.length > 0) await refreshExistingPlaylists(ids)
      }
    } catch (e: any) {
      log('error', 'Initial tick failed', { error: e?.message })
    }
  })()

  // primary cron job – runs every 3h
  cron.schedule('0 */3 * * *', async () => {
    const ids = loadPlaylistIds()
    log('info', `[CRON] tick -> ${ids.length} playlists in mode=${mode}`)
    try {
      if (mode === 'FETCH') {
        if (ids.length < 5) {
          log('info', '[DISCOVERY] Starting global region discovery mode')
          const count = await fetchNewPlaylists()
          log('info', `[DISCOVERY] Completed with ${count} playlists`)
        } else {
          await fetchNewPlaylists(ids)
        }
      } else {
        if (ids.length > 0) await refreshExistingPlaylists(ids)
      }
    } catch (e: any) {
      log('error', 'Cron tick failed', { error: e?.message })
    }
  })

  // cycle auto-switch – runs daily at midnight
  cron.schedule('0 0 * * *', async () => {
    const newMode = getCycleMode()
    if (newMode !== mode) {
      mode = newMode
      log('info', `[CYCLE] mode switched to ${newMode}`)
    }
  })
}

// start immediately when executed directly
try {
  startScheduler()
} catch {}

