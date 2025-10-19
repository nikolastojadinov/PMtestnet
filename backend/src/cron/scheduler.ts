import cron from 'node-cron'
import dotenv from 'dotenv'
import { log } from '../utils/logger.js'
import { startHttpServer } from '../server/http.js'
import { runDiscoveryTick } from '../youtube/fetcher.js'
import { QuotaDepletedError } from '../youtube/client.js'
import { refreshExistingPlaylists } from '../youtube/refreshExistingPlaylists.js'
import { supabase } from '../supabase/client.js'

dotenv.config()
try { startHttpServer() } catch {}

// Global region order
const REGION_SEQUENCE = ['IN', 'VN', 'PH', 'KR', 'US', 'JP', 'CN', 'RU']

// Watchdog (15 min)
async function runWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[WATCHDOG] runDiscoveryTick exceeded ${ms / 1000}s`)), ms)
    ),
  ])
}

async function readOrInitSchedulerState() {
  try {
    const { data } = await (supabase.from('scheduler_state').select('*').limit(1).single() as any)
    if (data) return data
    const now = new Date().toISOString()
    await supabase.from('scheduler_state').insert({
      mode: 'FETCH',
      day_in_cycle: 1,
      last_tick: now,
      updated_at: now,
    })
    return { mode: 'FETCH', day_in_cycle: 1 }
  } catch {
    return { mode: 'FETCH', day_in_cycle: 1 }
  }
}

async function persistNextState(prev: any) {
  const nextDay = prev.day_in_cycle >= 31 ? 1 : prev.day_in_cycle + 1
  const nextMode = nextDay === 31 ? 'REFRESH' : 'FETCH'
  const now = new Date().toISOString()
  await supabase
    .from('scheduler_state')
    .update({ mode: nextMode, day_in_cycle: nextDay, last_tick: now, updated_at: now })
  console.log(`[STATE] Cycle day=${nextDay} mode=${nextMode} (persisted)`)
  return { mode: nextMode, day_in_cycle: nextDay }
}

async function processRegionsSequentially() {
  log('info', `[DISCOVERY] Sequential global mode starting...`)
  for (const region of REGION_SEQUENCE) {
    try {
      log('info', `[FETCH] Starting region=${region}`)
      await runWithTimeout(runDiscoveryTick({ startRegion: region }), 900000)
      log('info', `[DISCOVERY] Completed region=${region}`)
      await supabase
        .from('discovery_state')
        .upsert({ last_region: region, updated_at: new Date().toISOString() })
      await new Promise((r) => setTimeout(r, 3000)) // pause between regions
    } catch (e: any) {
      if (e instanceof QuotaDepletedError) {
        log('warn', `[FETCH] QuotaDepletedError, stopping rotation`)
        break
      } else {
        log('warn', `[FETCH] Region ${region} failed`, { error: e?.message })
      }
    }
  }
}

export async function startScheduler() {
  const state = await readOrInitSchedulerState()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  log('info', `[STATE] Scheduler initialized: day=${state.day_in_cycle}, mode=${state.mode}`)
  log('info', `[TIME] UTC=${new Date().toISOString()}, Local(${tz})=${new Date().toLocaleString()}`)

  // Immediate start
  ;(async () => {
    try {
      if (state.mode === 'FETCH') await processRegionsSequentially()
      else await refreshExistingPlaylists([])
      await persistNextState(state)
    } catch (e: any) {
      log('error', 'Initial tick failed', { error: e?.message })
    }
  })()

  // Every 3 hours
  cron.schedule('0 */3 * * *', async () => {
    try {
      const current = await readOrInitSchedulerState()
      log('info', `[CRON] tick -> mode=${current.mode}`)
      if (current.mode === 'FETCH') await processRegionsSequentially()
      else await refreshExistingPlaylists([])
      await persistNextState(current)
    } catch (e: any) {
      log('error', 'Cron tick failed', { error: e?.message })
    }
  })
}

try {
  startScheduler()
} catch {}
