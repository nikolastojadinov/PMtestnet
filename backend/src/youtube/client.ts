import { google, youtube_v3 } from 'googleapis'
import dotenv from 'dotenv'
import { log } from '../utils/logger.js'

dotenv.config()

let currentKeyIndex = 0
let lastLoggedIndex = -1
const cooldownUntil = new Map<string, number>() // key -> epoch ms
const metrics = new Map<string, { used_units: number; quota_exceeded: number; last_used: number; cooldown_until?: number }>()

function safeParseKeys(): string[] {
  try {
    const raw = process.env.YOUTUBE_API_KEYS
    if (typeof raw === 'string' && raw.trim().length > 0) {
      const keys = raw
        .split(',')
        .map(k => k.trim())
        .filter(Boolean)
      log('info', `[YouTube] Loaded ${keys.length} API key(s) from YOUTUBE_API_KEYS.`)
      return keys
    }
  } catch (err: any) {
    console.warn('[YouTube] Failed to parse YOUTUBE_API_KEYS:', err?.message)
  }

  // fallback — pojedinačne varijable
  const fallback = ['YOUTUBE_API_KEY_1','YOUTUBE_API_KEY_2','YOUTUBE_API_KEY_3']
    .map(k => (process.env as any)[k] as string | undefined)
    .filter(Boolean)
    .map(v => v!.trim())

  if (fallback.length > 0) {
    log('info', `[YouTube] Loaded ${fallback.length} API key(s) from individual vars.`)
    return fallback
  }

  console.error('[YouTube] ⚠️ No API keys found in environment.')
  return []
}

function loadApiKeys(): string[] {
  const keys = safeParseKeys()
  return Array.from(new Set(keys)).filter(Boolean)
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

function pickCurrentKey(ban?: Set<string>): { key: string; index: number; total: number } | null {
  const keys = loadApiKeys()
  if (keys.length === 0) return null
  const total = keys.length
  const combinedBan = new Set<string>([...(ban ? Array.from(ban) : [])])
  for (let step = 0; step < total; step++) {
    const idx = (currentKeyIndex + step) % total
    const k = keys[idx]
    if (combinedBan.has(k)) continue
    const until = cooldownUntil.get(k)
    if (typeof until === 'number' && until > Date.now()) {
      // still cooling down; skip
      continue
    }
    return { key: k, index: idx, total }
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
export async function withKey<T>(fn: (yt: youtube_v3.Youtube) => Promise<T>, options?: WithKeyOptions): Promise<T> {
  const keys = loadApiKeys()
  if (keys.length === 0) throw new Error('No YouTube API keys configured (set YOUTUBE_API_KEYS or YOUTUBE_API_KEY_1..3)')

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
        log('warn', `[QUOTA] Key exhausted, switching… (idx=${index + 1}/${total})`, { label: label ?? null, cooldown_until: new Date(until).toISOString() })
        advanceIndex(total)
        attempts++
        if (attempts >= keys.length) throw new QuotaDepletedError()
        continue
      }
      throw err
    }
  }
}

export function youtubeClient(): youtube_v3.Youtube {
  const keys = loadApiKeys()
  if (keys.length === 0) {
    throw new Error('No YouTube API keys configured (set YOUTUBE_API_KEYS or YOUTUBE_API_KEY_1..3)')
  }
  const idx = currentKeyIndex % keys.length
  const key = keys[idx]
  logKeyIndex(idx, keys.length)
  return google.youtube({ version: 'v3', auth: key })
}
