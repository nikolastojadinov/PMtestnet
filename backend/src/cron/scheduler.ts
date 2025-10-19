import cron from 'node-cron'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { log } from '../utils/logger.js'
import { startHttpServer } from '../server/http.js'
import { runDiscoveryTick } from '../youtube/fetcher.js'
import { QuotaDepletedError } from '../youtube/client.js'
import { refreshExistingPlaylists } from '../youtube/refreshExistingPlaylists.js'
import { supabase } from '../supabase/client.js'

dotenv.config()
try { startHttpServer() } catch {}

const REGIONS = ['IN', 'VN', 'PH', 'KR', 'US', 'JP', 'CN', 'RU'] as const
type Mode = 'FETCH' | 'REFRESH'

type SchedulerState = {
  id: number | null
  mode: Mode
  day_in_cycle: number
  last_region?: string
}

const DEFAULT_STATE: SchedulerState = { id: null, mode: 'FETCH', day_in_cycle: 1, last_region: 'IN' }

async function readOrInitSchedulerState(): Promise<SchedulerState> {
  if (!supabase) {
    console.warn('[STATE] Supabase unavailable, using defaults.')
    return { ...DEFAULT_STATE }
  }

  try {
    const { data, error } = await (supabase.from('scheduler_state').select('*').limit(1).single() as any)
    if (error || !data) {
      console.warn('[STATE] scheduler_state missing, inserting defaults.')
      const now = new Date().toISOString()
      const { data: inserted } = await (supabase.from('scheduler_state')
        .insert({ mode: 'FETCH', day_in_cycle: 1, last_region: 'IN', last_tick: now, updated_at: now })
        .select()
        .single() as any)
      return inserted ?? { ...DEFAULT_STATE }
    }
    return { 
      id: data.id ?? null,
      mode: data.mode as Mode,
      day_in_cycle: data.day_in_cycle as number,
      last_region: data.last_region ?? 'IN'
    }
  } catch (e: any) {
    console.warn('[STATE] Supabase unavailable, using defaults.', e?.message)
    return { ...DEFAULT_STATE }
  }
}

async function persistNextState(prev: SchedulerState, lastRegion: string): Promise<SchedulerState> {
  const nextDay = prev.day_in_cycle >= 31 ? 1 : prev.day_in_cycle + 1
  const nextMode: Mode = nextDay === 31 ? 'REFRESH' : 'FETCH'
  const nextRegion = getNextRegion(lastRegion)

  if (!supabase || !prev.id) {
    console.warn('[STATE] Failed to persist, continuing with memory state.')
    return { ...prev, mode: nextMode, day_in_cycle: nextDay, last_region: nextRegion }
  }

  try {
    const now = new Date().toISOString()
    await (supabase.from('scheduler_state')
      .update({ mode: nextMode, day_in_cycle: nextDay, last_region: nextRegion, last_tick: now, updated_at: now })
      .eq('id', prev.id))
    console.log(`[STATE] Cycle day=${nextDay} mode=${nextMode} region=${nextRegion} (persisted)`)
  } catch (e: any) {
    console.warn('[STATE] Failed to persist scheduler state:', e?.message)
  }
  return { ...prev, mode: nextMode, day_in_cycle: nextDay, last_region: nextRegion }
}

function getNextRegion(current: string): string {
  const idx = REGIONS.indexOf(current as any)
  if (idx === -1 || idx === REGIONS.length - 1) return REGIONS[0]
  return REGIONS[idx + 1]
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

async function executeTick(state: SchedulerState) {
  try {
    const startRegion = state.last_region ?? 'IN'
    log('info', `[TICK START] UTC=${new Date().toISOString()}, startRegion=${startRegion}`)

    const ids = loadPlaylistIds()
    if (state.mode === 'FETCH') {
      try {
        const result = await runDiscoveryTick({ startRegion })
        await persistNextState(state, result.lastRegion)
        log('info', `[TICK END] Completed FETCH tick with ${result.totalPlaylists} playlists, lastRegion=${result.lastRegion}`)
      } catch (e: any) {
        log('error', '[TICK FAIL] Discovery tick failed', { error: e?.message })
      }
    } else {
      if (ids.length > 0) await refreshExistingPlaylists(ids)
      await persistNextState(state, state.last_region ?? 'IN')
      log('info', '[TICK END] Completed REFRESH tick')
    }
  } catch (e: any) {
    log('error', '[EXECUTE TICK] Fatal error', { error: e?.message })
  }
}

export async function startScheduler() {
  const initState = await readOrInitSchedulerState()
  console.log(`[STATE] Scheduler initialized: day=${initState.day_in_cycle}, mode=${initState.mode}, last_region=${initState.last_region}`)
  log('info', `Cron scheduler starting in mode=${initState.mode}`)

  // immediate first run
  await executeTick(initState)

  // repeat every 3h
  cron.schedule('0 */3 * * *', async () => {
    const state = await readOrInitSchedulerState()
    await executeTick(state)
  })
}

// start immediately when executed directly
try { startScheduler() } catch {}
