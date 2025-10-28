import React from 'react';
import { ensureGuestUserRecord, getGuest } from '@/lib/guestUser';

export function useGuestUser() {
  const [id, setId] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const uid = await ensureGuestUserRecord();
      if (!mounted) return;
      setId(uid);
      setReady(true);
    })();
    return () => { mounted = false; };
  }, []);

  const guest = React.useMemo(() => ({ id, wallet: 'Guest' as const, premium_until: null as string | null }), [id]);
  return { guest, ready };
}
