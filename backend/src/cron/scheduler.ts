import cron from 'node-cron'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { log } from '../utils/logger.js'
import { startHttpServer } from '../server/http.js'
import { runDiscoveryTick } from '../youtube/fetcher.js'
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

// ----- Global lock helpers ---------------------------------------------------
async function ensureSchedulerRow() {
  try {
    if (!supabase) return null
    const { data, error } = await (supabase
      .from('scheduler_state')
      .select('id, is_locked')
      .limit(1)
      .single() as any)
    if (error || !data) {
      const now = new Date().toISOString()
      const { data: inserted, error: insErr } = await (supabase
        .from('scheduler_state')
        .insert({
          mode: 'FETCH',
          day_in_cycle: 1,
          last_region: 'IN',
          last_tick: now,
          updated_at: now,
          is_locked: false,
        })
        .select('id, is_locked')
        .single() as any)
      if (insErr) {
        console.warn('[LOCK] Failed to initialize scheduler_state row:', insErr.message)
        return null
      }
      return inserted
    }
    return data
  } catch (e: any) {
    console.warn('[LOCK] Error ensuring scheduler_state row:', e?.message)
    return null
  }
}

async function acquireLock(): Promise<boolean> {
  if (!supabase) {
    console.warn('[LOCK] Supabase unavailable, proceeding without global lock.')
    return true
  }

  const row = await ensureSchedulerRow()
  if (!row) {
    console.warn('[LOCK] Unable to read/init scheduler_state; skipping this tick.')
    return false
  }

  try {
    if (row.is_locked) {
      console.warn('[LOCK] Scheduler is already running on another instance, skipping this tick.')
      return false
    }

    const now = new Date().toISOString()
    const { error: updErr } = await (supabase
      .from('scheduler_state')
      .update({ is_locked: true, updated_at: now })
      .eq('id', row.id) as any)
    if (updErr) {
      console.warn('[LOCK] Failed to acquire lock:', updErr.message)
      return false
    }
    console.log('[LOCK] Scheduler lock acquired.')
    return true
  } catch (e: any) {
    console.warn('[LOCK] Unexpected error acquiring lock:', e?.message)
    return false
  }
}

async function releaseLock(): Promise<void> {
  if (!supabase) return
  try {
    const now = new Date().toISOString()
    await (supabase
      .from('scheduler_state')
      .update({ is_locked: false, updated_at: now }) as any)
    console.log('[LOCK] Scheduler lock released.')
  } catch (e: any) {
    console.warn('[LOCK] Failed to release lock:', e?.message)
  }
}

async function runWithLock(fn: () => Promise<void>, state: SchedulerState) {
  const locked = await acquireLock()
  if (!locked) {
    log('warn', '[LOCK] Another instance is active, exiting.')
    return
  }
  try {
    await fn()
  } finally {
    await releaseLock()
  }
}

export async function startScheduler() {
  const initState = await readOrInitSchedulerState()
  console.log(`[STATE] Scheduler initialized: day=${initState.day_in_cycle}, mode=${initState.mode}, last_region=${initState.last_region}`)
  log('info', `Cron scheduler starting in mode=${initState.mode}`)

  // 🟢 odmah pokreni pri startu (npr. posle redeploy-a)
  await runWithLock(() => executeTick(initState), initState)

  // 🕘 dnevni jutarnji tick — 09:05 po Mađarskoj (07:05 UTC)
  cron.schedule('5 7 * * *', async () => {
    log('info', '[CRON] ☀️ Morning tick starting (09:05 CET)...')
    const state = await readOrInitSchedulerState()
    await runWithLock(() => executeTick(state), state)
    log('info', '[CRON] ☀️ Morning tick completed.')
  })

  // 🌙 večernji tick — 21:05 po Mađarskoj (19:05 UTC)
  cron.schedule('5 19 * * *', async () => {
    log('info', '[CRON] 🌙 Evening tick starting (21:05 CET)...')
    const state = await readOrInitSchedulerState()
    await runWithLock(() => executeTick(state), state)
    log('info', '[CRON] 🌙 Evening tick completed.')
  })
}

// start immediately when executed directly
try { startScheduler() } catch {}
