import cron from 'node-cron'
import dotenv from 'dotenv'
import { log } from '../utils/logger.js'
import { startHttpServer } from '../server/http.js'
import { discoverPlaylistsForRegion } from '../youtube/discovery.js'
import { QuotaDepletedError } from '../youtube/client.js'
import { supabase } from '../supabase/client.js'

dotenv.config()
try { startHttpServer() } catch {}

const REGIONS = ['IN', 'VN', 'PH', 'KR', 'JP', 'CN', 'RU', 'US'] as const
type Mode = 'FETCH' | 'REFRESH'

type SchedulerState = {
  id: number | null
  mode: Mode
  day_in_cycle: number
  last_region?: string
  updated_at?: string
  is_locked?: boolean
}

const DEFAULT_STATE: SchedulerState = { id: null, mode: 'FETCH', day_in_cycle: 1, last_region: 'IN' }
const LOCK_TTL_MS = 30 * 60 * 1000 // 30 min lock timeout
const MAX_DAILY_UNITS = 30000 // YouTube API quota per day

let usedUnits = 0
function canSpend(cost: number): boolean {
  return usedUnits + cost <= MAX_DAILY_UNITS
}
function spend(cost: number) {
  usedUnits += cost
}

// ---------------- Scheduler state helpers ----------------
async function readOrInitSchedulerState(): Promise<SchedulerState> {
  try {
    const { data, error } = await (supabase.from('scheduler_state').select('*').limit(1).single() as any)
    if (error || !data) {
      const now = new Date().toISOString()
      const { data: inserted } = await (supabase.from('scheduler_state')
        .insert({
          mode: 'FETCH',
          day_in_cycle: 1,
          last_region: 'IN',
          last_tick: now,
          updated_at: now,
          is_locked: false,
        })
        .select()
        .single() as any)
      return inserted ?? { ...DEFAULT_STATE }
    }

    if (data.is_locked && data.updated_at) {
      const lockTime = new Date(data.updated_at).getTime()
      if (Date.now() - lockTime > LOCK_TTL_MS) {
        console.warn('[LOCK] Stale lock detected, unlocking automatically.')
        await supabase.from('scheduler_state').update({ is_locked: false }).eq('id', data.id)
        data.is_locked = false
      }
    }

    return {
      id: data.id ?? null,
      mode: data.mode as Mode,
      day_in_cycle: data.day_in_cycle as number,
      last_region: data.last_region ?? 'IN',
      updated_at: data.updated_at,
      is_locked: data.is_locked,
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
  const now = new Date().toISOString()

  try {
    await (supabase.from('scheduler_state')
      .update({
        mode: nextMode,
        day_in_cycle: nextDay,
        last_region: nextRegion,
        last_tick: now,
        updated_at: now,
        is_locked: false,
      })
      .eq('id', prev.id))
    log('info', `[STATE] Cycle day=${nextDay} mode=${nextMode} region=${nextRegion} (persisted)`)
  } catch (e: any) {
    console.warn('[STATE] Failed to persist scheduler state:', e?.message)
  }

  return { ...prev, mode: nextMode, day_in_cycle: nextDay, last_region: nextRegion }
}

function getNextRegion(current: string): string {
  const idx = REGIONS.indexOf(current as any)
  return idx === -1 || idx === REGIONS.length - 1 ? REGIONS[0] : REGIONS[idx + 1]
}

// ---------------- Lock handling ----------------
async function acquireLock(): Promise<boolean> {
  try {
    const { data, error } = await (supabase.from('scheduler_state').select('id,is_locked,updated_at').limit(1).single() as any)
    if (error || !data) return false

    if (data.is_locked) {
      const diff = Date.now() - new Date(data.updated_at).getTime()
      if (diff < LOCK_TTL_MS) {
        console.warn('[LOCK] Scheduler is already running elsewhere.')
        return false
      }
      console.warn('[LOCK] Clearing stale lock automatically.')
      await supabase.from('scheduler_state').update({ is_locked: false }).eq('id', data.id)
    }

    const now = new Date().toISOString()
    await supabase.from('scheduler_state').update({ is_locked: true, updated_at: now }).eq('id', data.id)
    console.log('[LOCK] Scheduler lock acquired.')
    return true
  } catch (e: any) {
    console.warn('[LOCK] Failed to acquire lock:', e?.message)
    return false
  }
}

async function releaseLock(): Promise<void> {
  try {
    const now = new Date().toISOString()
    await supabase.from('scheduler_state').update({ is_locked: false, updated_at: now })
    console.log('[LOCK] Scheduler lock released.')
  } catch (e: any) {
    console.warn('[LOCK] Failed to release lock:', e?.message)
  }
}

// ---------------- Tick logic ----------------
async function executeTick(state: SchedulerState) {
  try {
    const startRegion = state.last_region ?? 'IN'
    log('info', `[TICK START] UTC=${new Date().toISOString()}, startRegion=${startRegion}`)

    try {
      const result = await discoverPlaylistsForRegion(startRegion, canSpend, spend, 7)
      await persistNextState(state, startRegion)
      log('info', `[TICK END] Region=${startRegion} newPlaylists=${result.playlistIds.length}`)
    } catch (e: any) {
      if (e instanceof QuotaDepletedError) {
        log('warn', `[WAIT] All API keys exhausted — cooling down for 60 minutes...`)
        await new Promise(res => setTimeout(res, 60 * 60 * 1000))
        await executeTick(state) // retry same region
      } else {
        log('error', `[TICK FAIL] ${startRegion} failed`, { error: e?.message })
      }
    }
  } catch (e: any) {
    log('error', '[EXECUTE TICK] Fatal error', { error: e?.message })
  }
}

// ---------------- Scheduler start ----------------
export async function startScheduler() {
  const initState = await readOrInitSchedulerState()
  console.log(`[STATE] Scheduler initialized: day=${initState.day_in_cycle}, mode=${initState.mode}, last_region=${initState.last_region}`)
  log('info', `Cron scheduler starting in mode=${initState.mode}`)

  if (await acquireLock()) {
    try {
      await executeTick(initState)
    } finally {
      await releaseLock()
    }
  }

  // ☀️ Morning tick — 07:05 UTC (09:05 CET)
  cron.schedule('5 7 * * *', async () => {
    log('info', '[CRON] ☀️ Morning tick starting...')
    const state = await readOrInitSchedulerState()
    if (await acquireLock()) {
      try {
        await executeTick(state)
      } finally {
        await releaseLock()
      }
    }
  })

  // 🌙 Evening tick — 19:05 UTC (21:05 CET)
  cron.schedule('5 19 * * *', async () => {
    log('info', '[CRON] 🌙 Evening tick starting...')
    const state = await readOrInitSchedulerState()
    if (await acquireLock()) {
      try {
        await executeTick(state)
      } finally {
        await releaseLock()
      }
    }
  })
}

try { startScheduler() } catch {}
