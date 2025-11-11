import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

declare global {
  interface Window { Pi?: any; }
}

// i18n lookup helper (fallback to raw key)
// use i18n from LanguageContext with a small fallback
function useI18n() {
  const { t } = useLanguage();
  return (key: string) => t(key) || (key === 'welcome_user' ? 'Welcome' : key);
}

interface AuthIntroProps {
  children?: React.ReactNode;
  onUser?: (profile: AuthUserProfile | null) => void;
}

interface AuthUserProfile {
  uid?: string;
  username: string;
  wallet?: string;
  language?: string;
  country?: string | null;
  user_id?: string; // Supabase id after persistence
}

function isPiBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /PiBrowser/i.test(ua) || !!window.Pi;
}

function getLocale(): { language?: string; country?: string | null } {
  try {
    const lang = navigator.language || (navigator as any).userLanguage;
    let country: string | null = null;
    if (lang && /[-_]/.test(lang)) country = lang.split(/[-_]/)[1]?.toUpperCase() || null;
    return { language: lang, country };
  } catch { return { language: undefined, country: null }; }
}

async function loadPiSdk(): Promise<any> {
  if (window.Pi) return window.Pi;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://sdk.minepi.com/pi-sdk.js';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Pi SDK failed to load'));
    document.head.appendChild(script);
  });
  return window.Pi;
}

async function piAuthenticate(): Promise<AuthUserProfile | null> {
  try {
    const Pi = await loadPiSdk();
    if (!Pi || typeof Pi.init !== 'function') return null;
    try { Pi.init({ version: '2.0', sandbox: false }); } catch { try { Pi.init(); } catch {} }
    const scopes = ['username', 'wallet_address'];
    const authResult = await Pi.authenticate(scopes);
    const username = authResult?.user?.username || '';
    const uid = authResult?.user?.uid;
    const wallet = authResult?.user?.wallet?.address || authResult?.user?.wallet || undefined;
    const { language, country } = getLocale();
    return { uid, username, wallet, language, country };
  } catch (e) {
    console.warn('[AuthIntro] Pi authenticate failed:', e);
    return null;
  }
}

async function persistToSupabase(profile: AuthUserProfile | null): Promise<string | undefined> {
  if (!profile || !profile.username) return undefined;
  try {
    const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || (import.meta as any).env?.VITE_SUPABASE_URL;
    const anon = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    if (!url || !anon) { console.warn('[AuthIntro] Missing Supabase env vars'); return undefined; }
  // Dynamic import may fail type resolution in some build contexts; use static require-style fallback.
  const mod: any = await import('@supabase/supabase-js');
  const createClient = mod.createClient || (mod.default?.createClient);
  if (!createClient) { console.warn('[AuthIntro] createClient not found in supabase-js'); return undefined; }
  const supabase = createClient(url, anon, { auth: { persistSession: true } });

    // Try to find existing by wallet or username
    let existingId: string | undefined;
    if (profile.wallet) {
      const { data, error } = await supabase.from('users').select('id').eq('wallet', profile.wallet).maybeSingle();
      if (!error && data?.id) existingId = data.id;
    }
    if (!existingId) {
      const { data, error } = await supabase.from('users').select('id').eq('username', profile.username).maybeSingle();
      if (!error && data?.id) existingId = data.id;
    }

    if (!existingId) {
      const insertRow: any = {
        wallet: profile.wallet || null,
        username: profile.username,
        created_at: new Date().toISOString(),
        language: profile.language || 'en',
        country: profile.country || 'GLOBAL',
        user_consent: true,
        premium_until: null,
        spotify_connected: false,
      };
      const { data, error } = await supabase.from('users').insert(insertRow).select('id').maybeSingle();
      if (error) { console.warn('[AuthIntro] Insert user error:', error.message); return undefined; }
      existingId = data?.id;
    } else {
      // Update last_login if column exists
      const { error: updErr } = await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', existingId);
      if (updErr) console.warn('[AuthIntro] Update last_login error:', updErr.message);
    }
    return existingId;
  } catch (e: any) {
    console.warn('[AuthIntro] Supabase persistence failed:', e?.message || e);
    return undefined;
  }
}

const AuthIntro: React.FC<AuthIntroProps> = ({ children, onUser }) => {
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [piRequired, setPiRequired] = useState(false);
  const [profile, setProfile] = useState<AuthUserProfile | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startRef = useRef<number>(Date.now());
  const i18n = useI18n();
  const { setUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const ensurePlay = async (): Promise<boolean> => {
      if (!videoRef.current) return false;
      try {
        const playPromise = videoRef.current.play();
        if (playPromise && typeof playPromise.then === 'function') {
          await playPromise; // may reject
        }
        return true;
      } catch {
        return false;
      }
    };

    const run = async () => {
      // Attempt autoplay early
      const played = await ensurePlay();
      if (!played) setAutoplayBlocked(true);

      let authProfile: AuthUserProfile | null = null;
      if (!isPiBrowser()) {
        setPiRequired(true);
      } else {
        authProfile = await piAuthenticate();
      }
      if (authProfile) {
        const userId = await persistToSupabase(authProfile);
        if (userId) authProfile.user_id = userId;
        else {
          try { localStorage.setItem('piUserPending', JSON.stringify(authProfile)); } catch {}
        }
        setUser(authProfile);
      }

      // Minimum 5s display
      const elapsed = Date.now() - startRef.current;
      const minMs = 5000;
      const waitMs = elapsed < minMs ? (minMs - elapsed) : 0;
      if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));

      if (cancelled) return;
      // If Pi Browser is required (not detected), keep the intro overlay visible
      // so users clearly see the message rather than the app continuing.
      if (piRequired) {
        // Do not hide the intro; show message overlay persistently
        return;
      }

      setProfile(authProfile);
      onUser?.(authProfile);
      setLoading(false);
      if (authProfile && authProfile.username) {
        setShowWelcome(true);
        setTimeout(() => {
          if (cancelled) return;
          setShowWelcome(false);
        }, 2000);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [onUser]);

  const handleTapToContinue = async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setAutoplayBlocked(false);
    } catch {}
  };

  // Offline retry to sync pending user every 30s
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        const raw = localStorage.getItem('piUserPending');
        if (!raw) return;
        const pending = JSON.parse(raw) as AuthUserProfile;
        const id = await persistToSupabase(pending);
        if (id) {
          localStorage.removeItem('piUserPending');
          setUser({ ...pending, user_id: id });
        }
      } catch (e) {
        // keep trying silently
      }
    }, 30000);
    return () => window.clearInterval(id);
  }, [setUser]);

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            src="/intro.mp4"
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {autoplayBlocked && (
            <button
              onClick={handleTapToContinue}
              className="absolute inset-0 flex items-center justify-center text-white text-lg bg-black/60"
            >Tap to continue</button>
          )}
          {piRequired && (
            <div className="absolute bottom-6 left-0 right-0 text-center text-white/90 text-sm px-4">
              Please open in Pi Browser
            </div>
          )}
        </div>
      )}

      {/* Welcome popup */}
      {showWelcome && profile?.username && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 animate-fadeIn">
          <div className="px-6 py-4 rounded-xl bg-white text-black text-xl font-semibold shadow-lg animate-fadeIn">
            {i18n('welcome_user')} {profile.username}
          </div>
        </div>
      )}

      {/* Main app content */}
      {!loading && (
        <div className="relative z-10 w-full h-full">{children}</div>
      )}
    </div>
  );
};

export default AuthIntro;
