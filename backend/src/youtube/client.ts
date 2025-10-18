import { google, youtube_v3 } from 'googleapis'
import dotenv from 'dotenv'
import { log } from '../utils/logger.js'

dotenv.config()

let currentKeyIndex = 0

function loadApiKeys(): string[] {
  // Preferred: comma-separated list in YOUTUBE_API_KEYS
  const primary = (process.env.YOUTUBE_API_KEYS?.split(',').map(k => k.trim()) ?? []).filter(Boolean)
  const keys = primary.length > 0 ? primary : (['YOUTUBE_API_KEY_1','YOUTUBE_API_KEY_2','YOUTUBE_API_KEY_3']
    .map(k => (process.env as any)[k] as string | undefined)
    .filter(Boolean)
    .map(v => v!.trim()))
  // Deduplicate and filter truthy
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

export function getRotatingKey(ban?: Set<string>): { key: string; index: number; total: number } | null {
  const keys = loadApiKeys()
  if (keys.length === 0) return null
  const total = keys.length
  for (let step = 0; step < total; step++) {
    const idx = (currentKeyIndex + step) % total
    const k = keys[idx]
    if (ban && ban.has(k)) continue
    currentKeyIndex = (idx + 1) % total
    return { key: k, index: idx, total }
  }
  return null
}

export async function withKey<T>(fn: (yt: youtube_v3.Youtube) => Promise<T>, ban?: Set<string>): Promise<T> {
  const localBan = ban ?? new Set<string>()
  const keys = loadApiKeys()
  if (keys.length === 0) throw new Error('No YouTube API keys configured (set YOUTUBE_API_KEYS or YOUTUBE_API_KEY_1..3)')

  let attempts = 0
  let pick = getRotatingKey(localBan)
  while (pick && attempts < keys.length) {
    const { key, index, total } = pick
    log('info', `[YouTube] Using key index ${index + 1}/${total}`)
    const yt = google.youtube({ version: 'v3', auth: key })
    try {
      return await fn(yt)
    } catch (err: any) {
      if (isQuotaExceeded(err)) {
        localBan.add(key)
        log('warn', `[QUOTA] Key exhausted, switching… (idx=${index + 1}/${total})`)
        pick = getRotatingKey(localBan)
        attempts++
        continue
      }
      throw err
    }
  }
  throw new QuotaDepletedError()
}

export function youtubeClient(): youtube_v3.Youtube {
  const keys = loadApiKeys()
  if (keys.length === 0) {
    throw new Error('No YouTube API keys configured (set YOUTUBE_API_KEYS or YOUTUBE_API_KEY_1..3)')
  }
  const idx = currentKeyIndex % keys.length
  const key = keys[idx]
  currentKeyIndex = (idx + 1) % keys.length
  log('info', `[YouTube] Using key index ${idx + 1}/${keys.length}`)
  return google.youtube({ version: 'v3', auth: key })
}
