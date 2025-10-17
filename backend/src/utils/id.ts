import { v5 as uuidv5 } from 'uuid'

// Deterministic namespaces using built-in DNS namespace to avoid hardcoding custom UUIDs
// Names are prefixed to ensure separation between entity types
export function playlistUuid(ytPlaylistId: string): string {
  return uuidv5(`ytpl:${ytPlaylistId}`, uuidv5.DNS)
}

export function trackUuid(ytVideoId: string): string {
  return uuidv5(`ytv:${ytVideoId}`, uuidv5.DNS)
}
