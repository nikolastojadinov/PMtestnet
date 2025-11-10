import { useState } from 'react';
import { authenticateUser, isPiBrowser } from '@/lib/pi';
import { upsertUser, detectCountry, detectDevice } from '@/lib/supabaseClient';

export default function PiLoginButton() {
  const [username, setUsername] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (typeof window !== 'undefined' && !isPiBrowser()) return null;

  const onClick = async () => {
    try {
      setBusy(true);
      const auth = await authenticateUser();
      if (!auth?.uid) return;
      const { error } = await upsertUser({
        pi_uid: auth.uid,
        username: auth.username,
        wallet: auth.wallet,
        language: navigator.language || 'en',
        user_consent: true,
        country: detectCountry(),
      } as any);
      if (error) console.warn('[PiLoginButton] upsert error', error.message || error);
      setUsername(auth.username);
      console.log('[PiLoginButton] logged in as', auth.username, detectDevice());
    } catch (e: any) {
      console.warn('[PiLoginButton] login failed', e?.message || String(e));
    } finally { setBusy(false); }
  };

  return (
    <button onClick={onClick} disabled={busy} className="px-3 py-2 rounded bg-purple-700 text-white text-sm hover:bg-purple-600 disabled:opacity-60">
      {username ? `Signed in: ${username}` : (busy ? 'Signing in…' : 'Sign in with Pi')}
    </button>
  );
}
