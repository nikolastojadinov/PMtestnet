import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

type User = {
  username: string;
  wallet: string;
  uid?: string;
};

type AuthCtx = {
  user: User | null;
  setUser: (u: User | null) => void;
  welcomeReady: boolean;   // becomes true once we have username+wallet
  clearWelcome: () => void;
};

const Ctx = createContext<AuthCtx>({
  user: null,
  setUser: () => {},
  welcomeReady: false,
  clearWelcome: () => {},
});

export const useAuth = () => useContext(Ctx);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [welcomeReady, setWelcomeReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (typeof window === 'undefined' || !('Pi' in window)) {
        // Not in Pi Browser — do nothing, app stays fully usable.
        return;
      }
      try {
        const scopes = ['username', 'wallet_address'];
        // onIncompletePaymentFound can be a no-op for now
        // @ts-ignore
        const auth = await window.Pi.authenticate(scopes, () => {});
        const u: User = {
          username: auth.user?.username,
          wallet: auth.user?.wallet_address,
          uid: auth.user?.uid,
        };
        if (cancelled) return;

        setUser(u);

        // Sync to backend (optional; ignore failures silently)
        try {
          const backend = import.meta.env.VITE_BACKEND_URL || (process.env as any)?.NEXT_PUBLIC_BACKEND_URL || '';
          if (backend) {
            await axios.post(`${backend}/users/sync`, {
              username: u.username,
              wallet_address: u.wallet,
              uid: u.uid,
            });
          }
        } catch (e) {
          console.warn('users/sync failed (ignored):', e);
        }

        // trigger single popup
        setWelcomeReady(true);
        // auto-hide signal after a short delay so it won’t re-trigger
        setTimeout(() => !cancelled && setWelcomeReady(false), 2500);
      } catch (e) {
        console.warn('Pi auth skipped/failed (app continues):', e);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  const clearWelcome = () => setWelcomeReady(false);

  return (
    <Ctx.Provider value={{ user, setUser, welcomeReady, clearWelcome }}>
      {children}
    </Ctx.Provider>
  );
};
