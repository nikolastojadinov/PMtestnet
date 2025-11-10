import { create } from 'zustand';
import { supabase } from './supabaseClient';

type User = {
  pi_uid: string;
  username: string | null;
  wallet: string | null;
  premium_until: string | null;
  language: string | null;
  country?: string | null;
};

type SessionState = {
  user: User | null;
  setUser: (u: User | null) => void;
};

export const useSession = create<SessionState>((set) => ({ user: null, setUser: (u)=> set({ user: u }) }));

export function isPremium(user: User | null | undefined): boolean {
  if (!user || !user.premium_until) return false;
  try { return new Date(user.premium_until).getTime() > Date.now(); } catch { return false; }
}

export async function getUserByPiUid(pi_uid: string) {
  if (!supabase) return { data: null, error: new Error('Supabase not initialized') };
  const { data, error } = await supabase.from('users').select('*').eq('pi_uid', pi_uid).maybeSingle();
  return { data, error };
}

export async function refreshUserSession() {
  try {
    const pi_uid = localStorage.getItem('pi_uid');
    if (!pi_uid) return null;
    const { data } = await getUserByPiUid(pi_uid);
    if (data) useSession.getState().setUser(data as any);
    return data;
  } catch { return null; }
}
