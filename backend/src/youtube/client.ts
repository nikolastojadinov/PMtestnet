import { google, youtube_v3 } from 'googleapis'
import dotenv from 'dotenv'
import { log } from '../utils/logger.js'

dotenv.config()

let currentKeyIndex = 0
let lastLoggedIndex = -1
let cachedKeys: string[] = []
const cooldownUntil = new Map<string, number>()
const metrics = new Map<string, { used_units: number; quota_exceeded: number; last_used: number; cooldown_until?: number }>()

// ✅ Parse comma-separated API keys safely
function loadApiKeys(): string[] {
  let raw = process.env.YOUTUBE_API_KEYS || ''
  if (!raw || typeof raw !== 'string') {
    log('error', '[YouTube] No YOUTUBE_API_KEYS found in environment.')
    return []
  }

  const keys = raw
    .split(',')
    .map(k => k.trim().replace(/^"|"$/g, '')) // remove quotes if any
    .filter(Boolean)

  if (keys.length === 0) {
    log('error', '[YouTube] No valid YouTube API keys found in YOUTUBE_API_KEYS.')
  } else if (cachedKeys.length === 0) {
    cachedKeys = keys
    log('info', `[YouTube] Initialized ${keys.length} API key(s) from YOUTUBE_API_KEYS.`)
  }

  return cachedKeys
}

function isQuotaExceeded(err: any): boolean {
  const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || ''
  const message = String(err?.message || '').toLowerCase()
  return /quota|ratelimit|dailyLimitExceeded|quotaExceeded/i.test(reason) || /quota/.test(message)
}

export class QuotaDepletedError extends Error {
  constructor() {
    super('All YouTube API keys exhausted')
    this.name = 'QuotaDepletedError'
  }
}

function pickCurrentKey(): { key: string; index: number; total: number } | null {
  const keys = loadApiKeys()
  if (keys.length === 0) return null
  const total = keys.length
  for (let i = 0; i < total; i++) {
    const idx = (currentKeyIndex + i) % total
    const key = keys[idx]
    const until = cooldownUntil.get(key)
    if (until && until > Date.now()) continue // still cooling down
    return { key, index: idx, total }
  }
  return null
}

function advanceIndex(total: number) {
  currentKeyIndex = (currentKeyIndex + 1) % total
}

function logKeyIndex(index: number, total: number) {
  if (index !== lastLoggedIndex) {
    log('info', `[YouTube] Using key index ${index + 1}/${total}`)
    lastLoggedIndex = index
  }
}

type WithKeyOptions = { label?: string; unitCost?: number }

export async function withKey<T>(
  fn: (yt: youtube_v3.Youtube) => Promise<T>,
  options?: WithKeyOptions
): Promise<T> {
  const keys = loadApiKeys()
  if (keys.length === 0) throw new Error('No YouTube API keys configured')

  const label = options?.label
  const unitCost = options?.unitCost ?? 0
  let attempts = 0

  for (;;) {
    const pick = pickCurrentKey()
    if (!pick) throw new QuotaDepletedError()
    const { key, index, total } = pick
    logKeyIndex(index, total)

    const now = Date.now()
    const m = metrics.get(key) || { used_units: 0, quota_exceeded: 0, last_used: 0 }
    m.last_used = now
    metrics.set(key, m)
    const yt = google.youtube({ version: 'v3', auth: key })

    try {
      const result = await fn(yt)
      if (unitCost > 0) {
        m.used_units += unitCost
        metrics.set(key, m)
      }
      return result
    } catch (err: any) {
      if (isQuotaExceeded(err)) {
        m.quota_exceeded += 1
        const coolMs = 60 * 60 * 1000 // 1h cooldown
        const until = Date.now() + coolMs
        cooldownUntil.set(key, until)
        m.cooldown_until = until
        metrics.set(key, m)
        log('warn', `[QUOTA] Key exhausted, switching… (idx=${index + 1}/${total})`, {
          label: label ?? null,
          cooldown_until: new Date(until).toISOString(),
        })
        advanceIndex(total)
        attempts++

        // ✅ New logic: if all keys are exhausted, pause for 60min then retry
        if (attempts >= keys.length) {
          log('warn', `[QUOTA] All keys temporarily exhausted — entering 60min cooldown.`)
          await new Promise(res => setTimeout(res, 60 * 60 * 1000)) // wait 1h
          attempts = 0
        }
        continue
      }
      throw err
    }
  }
}

export function youtubeClient(): youtube_v3.Youtube {
  const keys = loadApiKeys()
  if (keys.length === 0) throw new Error('No YouTube API keys configured')
  const idx = currentKeyIndex % keys.length
  const key = keys[idx]
  logKeyIndex(idx, keys.length)
  return google.youtube({ version: 'v3', auth: key })
}
