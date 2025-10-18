import cron from 'node-cron'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { log } from '../utils/logger.js'
import { startHttpServer } from '../server/http.js'
import { fetchNewPlaylists } from '../youtube/fetchNewPlaylists.js'
import { refreshExistingPlaylists } from '../youtube/refreshExistingPlaylists.js'
import { supabase } from '../supabase/client.js'

dotenv.config()
// ensure Render detects open port
try { startHttpServer() } catch {}

type Mode = 'FETCH' | 'REFRESH'

type SchedulerState = {
  id: number | null
  mode: Mode
  day_in_cycle: number
}

const DEFAULT_STATE: SchedulerState = { id: null, mode: 'FETCH', day_in_cycle: 1 }

async function readOrInitSchedulerState(): Promise<SchedulerState> {
  // If Supabase client is unavailable, fall back to defaults
  if (!supabase) {
    console.warn('[STATE] Supabase unavailable, using default in-memory state.')
    return { ...DEFAULT_STATE }
  }

  try {
    const { data, error } = await (supabase.from('scheduler_state')
      .select('*')
      .limit(1)
      .single() as any)

    if (error) {
      // Table missing or no rows yet
      console.warn('[STATE] Failed to fetch scheduler_state; will try to insert default. Reason:', error.message)
      const now = new Date().toISOString()
      const { data: inserted, error: insErr } = await (supabase.from('scheduler_state')
        .insert({ mode: 'FETCH', day_in_cycle: 1, last_tick: now, updated_at: now })
        .select()
        .single() as any)
      if (insErr) {
        console.warn('[STATE] Supabase insert failed, using in-memory defaults.', insErr.message)
        return { ...DEFAULT_STATE }
      }
      return { id: inserted.id ?? null, mode: inserted.mode as Mode, day_in_cycle: inserted.day_in_cycle as number }
    }

    // Data found
    return { id: (data as any).id ?? null, mode: (data as any).mode as Mode, day_in_cycle: (data as any).day_in_cycle as number }
  } catch (e: any) {
    console.warn('[STATE] Supabase unavailable, using default in-memory state.', e?.message)
    return { ...DEFAULT_STATE }
  }
}

async function persistNextState(prev: SchedulerState): Promise<SchedulerState> {
  const nextDay = prev.day_in_cycle >= 31 ? 1 : prev.day_in_cycle + 1
  const nextMode: Mode = nextDay === 31 ? 'REFRESH' as Mode : 'FETCH'

  if (!supabase || !prev.id) {
    console.warn('[STATE] Failed to update scheduler_state, continuing with last known values.')
    return { id: prev.id, mode: nextMode, day_in_cycle: nextDay }
  }

  try {
    const now = new Date().toISOString()
    const { error } = await (supabase.from('scheduler_state')
      .update({ mode: nextMode, day_in_cycle: nextDay, last_tick: now, updated_at: now })
      .eq('id', prev.id) as any)
    if (error) {
      console.warn('[STATE] Failed to update scheduler_state, continuing with last known values.', error.message)
    } else {
      console.log(`[STATE] Cycle day=${nextDay} mode=${nextMode} (persisted)`)    
    }
  } catch (e: any) {
    console.warn('[STATE] Failed to update scheduler_state, continuing with last known values.', e?.message)
  }
  return { id: prev.id, mode: nextMode, day_in_cycle: nextDay }
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
  const initState = await readOrInitSchedulerState()
  console.log(`[STATE] Scheduler initialized: day=${initState.day_in_cycle}, mode=${initState.mode}`)
  log('info', `Cron scheduler starting in mode=${initState.mode}`)

  // kick off immediately once on start
  ;(async () => {
    try {
      // Re-read latest state before running the tick
      let state = await readOrInitSchedulerState()
      const ids = loadPlaylistIds()
      log('info', `[INIT] tick -> ${ids.length} playlists in mode=${state.mode}`)
      if (state.mode === 'FETCH') {
        if (ids.length < 5) {
          log('info', '[DISCOVERY] Starting global region discovery mode')
          let count = 0
          try {
            count = await fetchNewPlaylists()
          } catch (e: any) {
            log('warn', '[WARN] fetchNewPlaylists failed; continuing cycle', { error: e?.message })
          }
          log('info', `[DISCOVERY] Completed with ${count} playlists`)
        } else {
          try {
            await fetchNewPlaylists(ids)
          } catch (e: any) {
            log('warn', '[WARN] fetchNewPlaylists failed; continuing cycle', { error: e?.message })
          }
        }
      } else {
        if (ids.length > 0) await refreshExistingPlaylists(ids)
      }
      // On successful tick, bump and persist state
      state = await persistNextState(state)
    } catch (e: any) {
      log('error', 'Initial tick failed', { error: e?.message })
    }
  })()

  // primary cron job – runs every 3h
  cron.schedule('0 */3 * * *', async () => {
    try {
      // Re-read latest state before running the tick
      let state = await readOrInitSchedulerState()
      const ids = loadPlaylistIds()
      log('info', `[CRON] tick -> ${ids.length} playlists in mode=${state.mode}`)
      if (state.mode === 'FETCH') {
        if (ids.length < 5) {
          log('info', '[DISCOVERY] Starting global region discovery mode')
          let count = 0
          try {
            count = await fetchNewPlaylists()
          } catch (e: any) {
            log('warn', '[WARN] fetchNewPlaylists failed; continuing cycle', { error: e?.message })
          }
          log('info', `[DISCOVERY] Completed with ${count} playlists`)
        } else {
          try {
            await fetchNewPlaylists(ids)
          } catch (e: any) {
            log('warn', '[WARN] fetchNewPlaylists failed; continuing cycle', { error: e?.message })
          }
        }
      } else {
        if (ids.length > 0) await refreshExistingPlaylists(ids)
      }
      // On successful tick, bump and persist state
      state = await persistNextState(state)
    } catch (e: any) {
      log('error', 'Cron tick failed', { error: e?.message })
    }
  })
}

// start immediately when executed directly
try {
  startScheduler()
} catch {}

