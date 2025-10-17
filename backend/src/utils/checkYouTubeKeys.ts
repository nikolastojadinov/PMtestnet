import axios from 'axios'
import dotenv from 'dotenv'

dotenv.config()

type KeyResult = 'ACTIVE' | 'LIMITED' | 'INVALID'

const KEY_NAMES = ['YOUTUBE_API_KEY_1', 'YOUTUBE_API_KEY_2', 'YOUTUBE_API_KEY_3'] as const

function nonEmpty(v?: string | null) {
  return typeof v === 'string' && v.trim().length > 0
}

async function testKey(name: string, value: string): Promise<KeyResult> {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${encodeURIComponent(value)}`
  try {
    const res = await axios.get(url, { validateStatus: () => true, timeout: 10000 })
    if (res.status === 200) {
      console.log(`[ACTIVE] ${name}: valid and responding.`)
      return 'ACTIVE'
    }
    if (res.status === 403) {
      const code = (res.data && (res.data.error?.errors?.[0]?.reason || res.data.error?.code)) || ''
      if (typeof code === 'string' && code.toLowerCase().includes('quota')) {
        console.log(`[LIMITED] ${name}: quota exceeded.`)
        return 'LIMITED'
      }
      console.log(`[INVALID] ${name}: invalid or disabled.`)
      return 'INVALID'
    }
    console.log(`[INVALID] ${name}: invalid or disabled. (status=${res.status})`)
    return 'INVALID'
  } catch (e: any) {
    console.log(`[INVALID] ${name}: invalid or disabled. (${e?.message || e})`)
    return 'INVALID'
  }
}

async function main() {
  const keys: Array<{ name: string; value: string }> = []
  for (const k of KEY_NAMES) {
    const v = process.env[k]
    if (nonEmpty(v)) keys.push({ name: k, value: v! })
  }
  if (keys.length === 0) {
    console.log('No YouTube API keys found in environment.')
    process.exit(0)
  }

  let active = 0, limited = 0, invalid = 0
  for (const k of keys) {
    const res = await testKey(k.name, k.value)
    if (res === 'ACTIVE') active++
    else if (res === 'LIMITED') limited++
    else invalid++
  }

  console.log('=== YouTube API Key Check Summary ===')
  console.log(`ACTIVE: ${active} | LIMITED: ${limited} | INVALID: ${invalid}`)
}

main().catch((e) => {
  console.error('Key check script failed:', e)
  process.exit(1)
})
