import { getSupabase } from './supabase.js';

export function isDay31() {
  // Treat every 31st day in a rolling window as "full refresh day"
  const now = new Date();
  const day = now.getDate();
  // If day=31 → true; if month has <31 days, use the last day as substitute
  const lastDay = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  return day === Math.min(31, lastDay);
}

export async function pickAllPlaylistIds(limit = 5000) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('playlists')
    .select('external_id')
    .limit(limit);
  if (error) throw error;
  return data?.map(r => r.external_id) || [];
}
