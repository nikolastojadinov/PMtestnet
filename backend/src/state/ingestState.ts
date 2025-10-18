type PerPlaylist = {
  id: string
  startedAt?: string
  finishedAt?: string
  itemsFetched?: number
  tracksLinked?: number
  error?: string | null
}

type IngestState = {
  mode: 'FETCH' | 'REFRESH'
  source: string
  playlistIds: string[]
  startedAt: string
  finishedAt?: string
  perPlaylist: Record<string, PerPlaylist>
}

let state: IngestState | null = null

export function ingestInit(mode: 'FETCH' | 'REFRESH', source: string, playlistIds: string[]) {
  state = {
    mode,
    source,
    playlistIds: [...playlistIds],
    startedAt: new Date().toISOString(),
    perPlaylist: {},
  }
}

export function ingestMarkStart(pid: string) {
  if (!state) return
  state.perPlaylist[pid] = {
    id: pid,
    startedAt: new Date().toISOString(),
  }
}

export function ingestMarkResult(pid: string, info: { itemsFetched: number; tracksLinked: number; error?: string | null }) {
  if (!state) return
  state.perPlaylist[pid] = {
    ...(state.perPlaylist[pid] || { id: pid }),
    finishedAt: new Date().toISOString(),
    itemsFetched: info.itemsFetched,
    tracksLinked: info.tracksLinked,
    error: info.error ?? null,
  }
}

export function ingestFinish() {
  if (!state) return
  state.finishedAt = new Date().toISOString()
}

export function getIngestState() {
  return state
}
