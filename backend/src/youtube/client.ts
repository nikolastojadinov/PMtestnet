import { google, youtube_v3 } from 'googleapis'
import dotenv from 'dotenv'
import { log } from '../utils/logger.js'

dotenv.config()

let currentKeyIndex = 0

function getApiKeys(): string[] {
  const out: string[] = []
  const raw = process.env.YOUTUBE_API_KEYS || ''
  if (raw) {
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) out.push(...arr)
    } catch {
      out.push(...raw.split(/[\s,]+/))
    }
  }
  for (const k of ['YOUTUBE_API_KEY_1','YOUTUBE_API_KEY_2','YOUTUBE_API_KEY_3']) {
    const v = process.env[k]
    if (v) out.push(v)
  }
  return out.map(k => (k || '').trim()).filter(Boolean)
}

export function youtubeClient(): youtube_v3.Youtube {
  const keys = getApiKeys()
  if (keys.length === 0) {
    throw new Error('No YouTube API keys configured (set YOUTUBE_API_KEYS or YOUTUBE_API_KEY_1..3)')
  }
  const activeIndex = currentKeyIndex % keys.length
  const key = keys[activeIndex]
  currentKeyIndex = (activeIndex + 1) % keys.length
  log('info', `[YouTube] Using key index ${activeIndex + 1}/${keys.length}`)
  return google.youtube({ version: 'v3', auth: key })
}

export class QuotaDepletedError extends Error {
  constructor() {
    super('All YouTube API keys exhausted')
    this.name = 'QuotaDepletedError'
  }
}

function isQuotaExceeded(err: any): boolean {
  const reason = err?.errors?.[0]?.reason || err?.response?.data?.error?.errors?.[0]?.reason || ''
  const message = String(err?.message || '').toLowerCase()
  return /quota|rateLimit/i.test(reason) || /quota/.test(message)
}

export function getRotatingKey(ban?: Set<string>): { key: string, index: number, total: number } | null {
  const keys = getApiKeys()
  if (keys.length === 0) return null
  const total = keys.length
  for (let i = 0; i < total; i++) {
    const idx = (currentKeyIndex + i) % total
    const k = keys[idx]
    if (ban && ban.has(k)) continue
    // advance pointer to next position for future calls
    currentKeyIndex = (idx + 1) % total
    return { key: k, index: idx, total }
  }
  return null
}

export async function withKey<T>(fn: (yt: youtube_v3.Youtube) => Promise<T>, ban?: Set<string>): Promise<T> {
  const localBan = ban ?? new Set<string>()
  const first = getRotatingKey(localBan)
  if (!first) throw new QuotaDepletedError()
  let attempt = 0
  const max = (function() { const keys = getApiKeys(); return keys.length })()
  let cur = first
  while (cur && attempt < max) {
    const { key, index, total } = cur
    const yt = google.youtube({ version: 'v3', auth: key })
    try {
      return await fn(yt)
    } catch (err: any) {
      if (isQuotaExceeded(err)) {
        localBan.add(key)
        log('warn', `[QUOTA] Key exhausted, switching… (idx=${index + 1}/${total})`)
        const next = getRotatingKey(localBan)
        attempt++
        if (!next) {
          throw new QuotaDepletedError()
        }
        cur = next
        continue
      }
      throw err
    }
  }
  throw new QuotaDepletedError()
}
