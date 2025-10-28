import { supabase } from '@/lib/supabaseClient';

const KEY = 'pm_guest_uuid';

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // fallback
  const rnd = (n = 16) => Array.from(crypto?.getRandomValues?.(new Uint8Array(n)) || Array.from({ length: n }, () => Math.floor(Math.random() * 256)));
  const b = rnd(16);
  // RFC4122 version 4
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const s = b.map(toHex).join('');
  return `${s.substring(0,8)}-${s.substring(8,12)}-${s.substring(12,16)}-${s.substring(16,20)}-${s.substring(20)}`;
}

export function getOrCreateGuestId(): string | null {
  if (typeof window === 'undefined') return null;
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export async function ensureGuestUserRecord(): Promise<string | null> {
  const id = getOrCreateGuestId();
  if (!id) return null;
  try {
    await supabase
      .from('users')
      .upsert({ user_id: id, wallet: 'Guest' }, { onConflict: 'user_id' });
  } catch {
    // ignore
  }
  return id;
}

export function getGuest() {
  const id = (typeof window !== 'undefined') ? (localStorage.getItem(KEY) || null) : null;
  return { id, wallet: 'Guest' as const, premium_until: null as string | null };
}
