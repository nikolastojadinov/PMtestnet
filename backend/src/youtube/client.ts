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
