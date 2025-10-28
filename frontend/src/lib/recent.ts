// Local Recently Played playlists helper
// Stores up to 8 recent playlist entries in localStorage

export type RecentPlaylist = {
  id: string;
  title: string;
  cover_url?: string | null;
  region?: string | null;
  category?: string | null;
  played_at: string; // ISO string
};

const KEY = 'pm_recent_playlists_v1';
const MAX = 8;

function safeGetStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getRecent(): RecentPlaylist[] {
  const ls = safeGetStorage();
  if (!ls) return [];
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecentPlaylist[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX);
  } catch {
    return [];
  }
}

export function pushRecent(entry: Omit<RecentPlaylist, 'played_at'>) {
  const ls = safeGetStorage();
  if (!ls) return;
  try {
    const now: RecentPlaylist = { ...entry, played_at: new Date().toISOString() };
    const current = getRecent();
    const deduped = [now, ...current.filter((e) => e.id !== entry.id)];
    const trimmed = deduped.slice(0, MAX);
    ls.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}
