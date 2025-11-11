import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';

type PiAuthUser = { username: string; wallet_address: string; uid?: string };
type PaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => Promise<void> | void;
  onReadyForServerCompletion: (paymentId: string) => Promise<void> | void;
  onCancel: (paymentId: string) => void;
  onError: (error: unknown, paymentId: string) => void;
};
type PiSDK = {
  authenticate: (
    scopes: string[],
    onIncompletePaymentFound: (payment: unknown) => void
  ) => Promise<{ user: PiAuthUser }>;
  createPayment: (
    data: { amount: number; memo: string; metadata?: Record<string, unknown> },
    callbacks: PaymentCallbacks
  ) => Promise<void>;
};

declare global { interface Window { Pi?: PiSDK } }

type PiUser = PiAuthUser;
type PiSDKContextType = {
  user: PiUser | null;
  loading: boolean;
  createPayment: (amount: number, memo: string, metadata?: Record<string, unknown>) => Promise<void>;
};

const PiSDKContext = createContext<PiSDKContextType>({
  user: null,
  loading: false,
  createPayment: async () => Promise.resolve(),
});

export const usePiSDK = () => useContext(PiSDKContext);

export const PiSDKProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PiUser | null>(null);
  const [loading, setLoading] = useState(true);

  const { setUser: setAuthUser } = useAuth();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.Pi) {
      console.warn('Pi SDK not detected — open in Pi Browser.');
      setLoading(false);
      return;
    }
    const initAuth = async () => {
      try {
        const scopes = ['username', 'wallet_address'];
        const auth = await window.Pi!.authenticate(scopes, (payment) => {
          console.debug('incomplete payment found', payment);
        });
        const { username, wallet_address, uid } = auth.user;
        const profile: PiUser = { username, wallet_address, uid };
        setUser(profile);
        setAuthUser({ username, wallet_address, uid });
        const backend = import.meta.env.VITE_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';
        if (backend) {
          try {
            await axios.post(`${backend}/users/sync`, profile, { timeout: 8000 });
          } catch (e) {
            console.warn('User sync failed, caching locally', e);
            try {
              localStorage.setItem('piUserPending', JSON.stringify(profile));
            } catch (storageErr) {
              console.debug('Failed to persist pending user locally', storageErr);
            }
          }
        }
      } catch (e) {
        console.warn('Pi Auth error:', e);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, [setAuthUser]);

  // Retry pending sync every 30s
  useEffect(() => {
    const id = setInterval(async () => {
      const backend = import.meta.env.VITE_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';
      if (!backend) return;
      const raw = localStorage.getItem('piUserPending');
      if (!raw) return;
      try {
        const pending = JSON.parse(raw);
  await axios.post(`${backend}/users/sync`, pending, { timeout: 8000 });
        localStorage.removeItem('piUserPending');
        console.log('✅ Synced pending user to backend');
  } catch (err) { console.debug('retry pending user sync later'); }
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const createPayment = async (amount: number, memo: string, metadata: Record<string, unknown> = {}) => {
    if (!window.Pi) {
      alert('Please open in Pi Browser.');
      return;
    }
    try {
      const paymentData = { amount, memo, metadata };
      const backend = import.meta.env.VITE_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '';
      const callbacks = {
        onReadyForServerApproval: async (paymentId: string) => {
          if (backend) await axios.post(`${backend}/payments/approve`, { paymentId });
        },
        onReadyForServerCompletion: async (paymentId: string) => {
          if (backend) await axios.post(`${backend}/payments/complete`, { paymentId, txid: 'stub-txid' });
        },
        onCancel: (paymentId: string) => { console.warn('Payment cancelled:', paymentId); },
        onError: (error: unknown, paymentId: string) => { console.error('Payment error:', paymentId, error); },
      };
      await window.Pi!.createPayment(paymentData, callbacks);
    } catch (e) {
      console.error('Payment exception:', e);
    }
  };

  return (
    <PiSDKContext.Provider value={{ user, loading, createPayment }}>
      {children}
    </PiSDKContext.Provider>
  );
};
