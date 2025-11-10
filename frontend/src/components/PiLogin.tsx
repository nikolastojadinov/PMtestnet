import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { upsertUser, detectCountry } from '../lib/supabaseClient';

declare global {
  interface Window { Pi?: any }
}

function isPiBrowser() {
  if (typeof window === 'undefined') return false;
  return window.name === 'PiBrowser' || /PiBrowser/i.test(navigator.userAgent || '');
}

async function loadPiSdk(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.Pi) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.minepi.com/pi-sdk.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Pi SDK'));
    document.head.appendChild(s);
  });
}

export default function PiLogin() {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const appId = useMemo(() => (import.meta as any)?.env?.NEXT_PUBLIC_PI_APP_ID || (import.meta as any)?.env?.VITE_PI_APP_ID || undefined, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPiBrowser()) {
        // Not Pi Browser; don't block app
        return;
      }
      try {
        await loadPiSdk();
        if (!window.Pi) {
          console.warn('[PiLogin] Pi object missing after script load');
          return;
        }
        // Initialize SDK as per official demo
        try {
          window.Pi.init({ version: '2.0', appId, sandbox: true });
          console.log('[PiLogin] Pi SDK initialized');
        } catch (e) {
          console.warn('[PiLogin] Pi.init failed', (e as any)?.message || e);
        }
        if (!cancelled) setReady(true);
      } catch (e) {
        console.warn('[PiLogin] SDK load failed', (e as any)?.message || e);
      }
    })();
    return () => { cancelled = true; };
  }, [appId]);

  const onLogin = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (!window.Pi) throw new Error('Pi SDK not available (open in Pi Browser)');
      const onIncompletePaymentFound = (payment: any) => {
        console.warn('[PiLogin] Incomplete payment found', payment?.identifier || payment);
      };
      const auth = await window.Pi.authenticate(['username', 'payments', 'wallet_address'], onIncompletePaymentFound);
      const user = auth?.user || {};
      setUsername(user?.username || null);

      // Persist locally for quick checks
      try { localStorage.setItem('pi_user', JSON.stringify({ username: user?.username, uid: user?.uid })); } catch {}

      // Optionally upsert to Supabase (best-effort)
      try {
        await upsertUser({
          pi_uid: user?.uid,
          username: user?.username || null,
          wallet: user?.wallet_address || null,
          language: navigator.language || 'en',
          user_consent: true,
          country: detectCountry(),
        } as any);
      } catch (e) {
        console.warn('[PiLogin] upsertUser failed', (e as any)?.message || e);
      }
    } catch (e: any) {
      console.error('[PiLogin] Authentication error', e);
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // Optional: demo-style payment opener using openPayment()
  const onTestPayment = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (!window.Pi) throw new Error('Pi SDK not available (open in Pi Browser)');
      const openPayment = window.Pi.openPayment || window.Pi.createPayment;
      if (!openPayment) throw new Error('Pi payment API not available');
      openPayment({ amount: 0.01, memo: 'PM Test Payment', metadata: { source: 'demo' } }, {
        onReadyForServerApproval: (paymentId: string) => {
          console.log('[PiLogin] onReadyForServerApproval', paymentId);
        },
        onReadyForServerCompletion: (paymentId: string, txid: string) => {
          console.log('[PiLogin] onReadyForServerCompletion', paymentId, txid);
          setError(null);
        },
        onCancel: (paymentId: string) => {
          console.warn('[PiLogin] Payment cancelled', paymentId);
        },
        onError: (err: any) => {
          console.error('[PiLogin] Payment error', err);
          setError(err?.message || 'Payment error');
        }
      });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onLogin}
        disabled={busy || !isPiBrowser()}
        className="px-3 py-2 rounded bg-purple-700 text-white text-sm hover:bg-purple-600 disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Login with Pi'}
      </button>
      <button
        onClick={onTestPayment}
        disabled={busy || !ready}
        className="px-3 py-2 rounded bg-amber-600 text-black text-sm hover:bg-amber-500 disabled:opacity-60"
      >
        Test Payment
      </button>
      {username && <span className="text-sm text-muted-foreground">Signed in: {username}</span>}
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}

