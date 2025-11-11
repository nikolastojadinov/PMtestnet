import React, { createContext, useContext } from 'react';
import axios from 'axios';

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
  ) => Promise<{ user: { username: string; wallet_address: string; uid?: string } }>;
  createPayment: (
    data: { amount: number; memo: string; metadata?: Record<string, unknown> },
    callbacks: PaymentCallbacks
  ) => Promise<void>;
};

declare global { interface Window { Pi?: PiSDK } }

type PiSDKContextType = {
  createPayment: (amount: number, memo: string, metadata?: Record<string, unknown>) => Promise<void>;
};

const PiSDKContext = createContext<PiSDKContextType>({
  createPayment: async () => Promise.resolve(),
});

export const usePiSDK = () => useContext(PiSDKContext);

export const PiSDKProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

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
    <PiSDKContext.Provider value={{ createPayment }}>
      {children}
    </PiSDKContext.Provider>
  );
};
