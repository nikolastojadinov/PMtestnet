import { google, youtube_v3 } from 'googleapis'
import dotenv from 'dotenv'
import { log } from '../utils/logger.js'

dotenv.config()

let currentKeyIndex = 0
let lastLoggedIndex = -1
const exhaustedKeys = new Set<string>()

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

function pickCurrentKey(ban?: Set<string>): { key: string; index: number; total: number } | null {
  const keys = loadApiKeys()
  if (keys.length === 0) return null
  const total = keys.length
  const combinedBan = new Set<string>([...exhaustedKeys, ...(ban ? Array.from(ban) : [])])
  for (let step = 0; step < total; step++) {
    const idx = (currentKeyIndex + step) % total
    const k = keys[idx]
    if (combinedBan.has(k)) continue
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

export async function withKey<T>(fn: (yt: youtube_v3.Youtube) => Promise<T>, ban?: Set<string>): Promise<T> {
  const keys = loadApiKeys()
  if (keys.length === 0) throw new Error('No YouTube API keys configured (set YOUTUBE_API_KEYS or YOUTUBE_API_KEY_1..3)')

  const localBan = ban ?? new Set<string>()
  let attempts = 0

  for (;;) {
    const pick = pickCurrentKey(localBan)
    if (!pick) throw new QuotaDepletedError()
    const { key, index, total } = pick
    logKeyIndex(index, total)
    const yt = google.youtube({ version: 'v3', auth: key })
    try {
      const result = await fn(yt)
      // Do NOT advance index on success; keep using current key
      return result
    } catch (err: any) {
      if (isQuotaExceeded(err)) {
        exhaustedKeys.add(key)
        localBan.add(key)
        log('warn', `[QUOTA] Key exhausted, switching… (idx=${index + 1}/${total})`)
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
  // Do NOT advance currentKeyIndex here to avoid unintended rotation on client creation
  logKeyIndex(idx, keys.length)
  return google.youtube({ version: 'v3', auth: key })
}
