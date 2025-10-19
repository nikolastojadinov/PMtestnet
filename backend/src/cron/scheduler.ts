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

// ensure Render detects open port
try { startHttpServer() } catch {}

// region rotation order
const REGION_SEQUENCE = ['IN', 'VN', 'PH', 'KR', 'US', 'JP', 'CN', 'RU']

// helper to move to next region
function nextRegion(current: string): string {
  const idx = REGION_SEQUENCE.indexOf(current)
  return idx >= 0 && idx < REGION_SEQUENCE.length - 1
    ? REGION_SEQUENCE[idx + 1]
    : REGION_SEQUENCE[0]
}

// watchdog timeout (15min)
async function runWithGlobalTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[WATCHDOG] runDiscoveryTick exceeded ${ms / 1000}s, aborting`)), ms)
    ),
  ])
}

type Mode = 'FETCH' | 'REFRESH'
type SchedulerState = { id: number | null; mode: Mode; day_in_cycle: number }

const DEFAULT_STATE: SchedulerState = { id: null, mode: 'FETCH', day_in_cycle: 1 }

// read or create scheduler_state
async function readOrInitSchedulerState(): Promise<SchedulerState> {
  if (!supabase) {
    console.warn('[STATE] Supabase unavailable, using default in-memory state.')
    return { ...DEFAULT_STATE }
  }
  try {
    const { data, error } = await (supabase.from('scheduler_state').select('*').limit(1).single() as any)
    if (error || !data) {
      console.warn('[STATE] No scheduler_state found, inserting default.')
      const now = new Date().toISOString()
      const { data: inserted } = await (supabase.from('scheduler_state')
        .insert({ mode: 'FETCH', day_in_cycle: 1, last_tick: now, updated_at: now })
        .select()
        .single() as any)
      return { id: inserted?.id ?? null, mode: 'FETCH', day_in_cycle: 1 }
    }
    return { id: data.id ?? null, mode: data.mode as Mode, day_in_cycle: data.day_in_cycle as number }
  } catch {
    console.warn('[STATE] Scheduler state unavailable, using defaults.')
    return { ...DEFAULT_STATE }
  }
}

// persist next day/mode
async function persistNextState(prev: SchedulerState): Promise<SchedulerState> {
  const nextDay = prev.day_in_cycle >= 31 ? 1 : prev.day_in_cycle + 1
  const nextMode: Mode = nextDay === 31 ? 'REFRESH' : 'FETCH'
  if (!supabase || !prev.id) return { id: prev.id, mode: nextMode, day_in_cycle: nextDay }
  try {
    const now = new Date().toISOString()
    await (supabase.from('scheduler_state')
      .update({ mode: nextMode, day_in_cycle: nextDay, last_tick: now, updated_at: now })
      .eq('id', prev.id) as any)
    console.log(`[STATE] Cycle day=${nextDay} mode=${nextMode} (persisted)`)
  } catch (e: any) {
    console.warn('[STATE] Failed to update scheduler_state', e?.message)
  }
  return { id: prev.id, mode: nextMode, day_in_cycle: nextDay }
}

// read current region or set default
async function readOrInitDiscoveryState(): Promise<{ region: string }> {
  if (!supabase) return { region: 'IN' }
  try {
    const { data, error } = await (supabase.from('discovery_state').select('last_region').limit(1).single() as any)
    if (error || !data) {
      await (supabase.from('discovery_state')
        .insert({ last_region: 'IN', updated_at: new Date().toISOString() }) as any)
      return { region: 'IN' }
    }
    return { region: data.last_region || 'IN' }
  } catch {
    return { region: 'IN' }
  }
}

// save next region to discovery_state
async function persistNextRegion(current: string) {
  const next = nextRegion(current)
  try {
    await (supabase.from('discovery_state')
      .update({ last_region: next, updated_at: new Date().toISOString() })
      .neq('last_region', next) as any)
    log('info', `[ROTATION] Next region scheduled = ${next}`)
  } catch (e: any) {
    log('warn', '[ROTATION] Failed to persist next region', { error: e?.message })
  }
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
    log('warn', 'Failed to read regions file', { file, error: (e as Error).message })
    return []
  }
}

export async function startScheduler() {
  const initState = await readOrInitSchedulerState()
  console.log(`[STATE] Scheduler initialized: day=${initState.day_in_cycle}, mode=${initState.mode}`)
  log('info', `Cron scheduler starting in mode=${initState.mode}`)

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  log('info', `[TICK START] UTC=${new Date().toISOString()}, Local(${tz})=${new Date().toLocaleString()}`)

  // immediate tick on startup
  ;(async () => {
    try {
      let state = await readOrInitSchedulerState()
      const ids = loadPlaylistIds()
      const { region } = await readOrInitDiscoveryState()
      log('info', `[INIT] tick -> ${ids.length} playlists in mode=${state.mode}`)
      log('info', `[DISCOVERY] Starting global region discovery mode (start=${region})`)
      if (state.mode === 'FETCH') {
        try {
          await runWithGlobalTimeout(runDiscoveryTick({ startRegion: region }), 900000)
          await persistNextRegion(region)
        } catch (e: any) {
          if (e instanceof QuotaDepletedError)
            log('warn', '[WARN] runDiscoveryTick stopped: QuotaDepletedError')
          else
            log('warn', '[WARN] runDiscoveryTick error', { error: e?.message })
        }
      } else if (ids.length > 0) {
        await refreshExistingPlaylists(ids)
      }
      state = await persistNextState(state)
    } catch (e: any) {
      log('error', 'Initial tick failed', { error: e?.message })
    }
  })()

  // cron job every 3 hours
  cron.schedule('0 */3 * * *', async () => {
    try {
      let state = await readOrInitSchedulerState()
      const ids = loadPlaylistIds()
      const { region } = await readOrInitDiscoveryState()
      log('info', `[CRON] tick -> ${ids.length} playlists in mode=${state.mode}`)
      log('info', `[DISCOVERY] Starting global region discovery mode (start=${region})`)
      if (state.mode === 'FETCH') {
        try {
          await runWithGlobalTimeout(runDiscoveryTick({ startRegion: region }), 900000)
          await persistNextRegion(region)
        } catch (e: any) {
          if (e instanceof QuotaDepletedError)
            log('warn', '[WARN] runDiscoveryTick stopped: QuotaDepletedError')
          else
            log('warn', '[WARN] runDiscoveryTick error', { error: e?.message })
        }
      } else if (ids.length > 0) {
        await refreshExistingPlaylists(ids)
      }
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
