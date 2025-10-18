import { google, youtube_v3 } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

function readApiKeys(): string[] {
  try {
    const keys: string[] = []
    const raw = process.env.YOUTUBE_API_KEYS
    if (raw) {
      try {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) keys.push(...arr.filter(Boolean))
      } catch {
        // Fallback: comma/whitespace-separated
        keys.push(...raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean))
      }
    }
    for (const k of ['YOUTUBE_API_KEY_1','YOUTUBE_API_KEY_2','YOUTUBE_API_KEY_3']) {
      const v = process.env[k]
      if (v && !keys.includes(v)) keys.push(v)
    }
    return keys
  } catch {
    return []
  }
}

export class YouTubeClient {
  private keys: string[]
  private keyIndex = 0
  private requestCount = 0
  private yt: youtube_v3.Youtube

  constructor() {
    this.keys = readApiKeys()
    this.yt = google.youtube('v3')
    const count = this.keys.length
    if (count > 0) {
      console.log(`YouTube API key rotation loaded (${count} keys detected)`) 
    } else {
      console.warn('YouTube API keys not configured.')
    }
  }

  private nextKey(): string | undefined {
    if (!this.keys.length) return undefined
    // Rotate the API key only once per 100 requests to respect quota distribution
    const key = this.keys[this.keyIndex % this.keys.length]
    this.requestCount++
    if (this.requestCount % 100 === 0) {
      this.keyIndex++
    }
    return key
  }

  async getPlaylist(playlistId: string) {
    const key = this.nextKey()
    const res = await this.yt.playlists.list({
      id: [playlistId],
      part: ['snippet', 'contentDetails'],
      maxResults: 1,
      auth: key,
    })
    const item = res.data.items?.[0]
    return { item, keyUsed: key }
  }

  async getPlaylistItems(playlistId: string, max = 200) {
    const key = this.nextKey()
    const items: youtube_v3.Schema$PlaylistItem[] = []
    let pageToken: string | undefined = undefined

    while (items.length < max) {
      const res: import('gaxios').GaxiosResponse<youtube_v3.Schema$PlaylistItemListResponse> = await this.yt.playlistItems.list({
        playlistId,
        part: ['snippet', 'contentDetails'],
        maxResults: 50,
        pageToken,
        auth: key,
      })
      items.push(...(res.data.items ?? []))
      pageToken = res.data.nextPageToken ?? undefined
      if (!pageToken) break
    }

    return { items, keyUsed: key }
  }

  async getVideoDetails(videoIds: string[]) {
    if (videoIds.length === 0) return { items: [], keyUsed: undefined as string | undefined }
    const key = this.nextKey()
    const res = await this.yt.videos.list({
      id: videoIds,
      part: ['snippet', 'contentDetails'],
      maxResults: 50,
      auth: key,
    })
    return { items: res.data.items ?? [], keyUsed: key }
  }

  async getChannelDetails(channelId: string) {
    const key = this.nextKey()
    const res = await this.yt.channels.list({
      id: [channelId],
      part: ['snippet', 'statistics'],
      maxResults: 1,
      auth: key,
    })
    const ch = res.data.items?.[0]
    return { item: ch, keyUsed: key }
  }
}
