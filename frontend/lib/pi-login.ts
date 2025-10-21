/**
 * Pi Browser auto-login trigger:
 *  - try to read Pi context (username, wallet, language) if available
 *  - call backend /api/auth/login-pi (idempotent upsert in Supabase)
 *  - store user payload in sessionStorage
 * This is a harmless no-op outside Pi Browser.
 */
import { api } from './api';
export async function loginWithPi(){
  try{
    const piContext:any = (globalThis as any).Pi?.context || {};
    const payload = {
      pi_token: piContext?.token || null,
      username: piContext?.username || null,
      wallet: piContext?.wallet || null,
      language: navigator.language || 'en'
    };
    const res = await api('/api/auth/login-pi',{ method:'POST', body: JSON.stringify(payload) });
    sessionStorage.setItem('pm_user', JSON.stringify(res?.user||{}));
    return res;
  }catch(e){ /* ignore */ }
}
