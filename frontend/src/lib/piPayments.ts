import axios from 'axios';

type PaymentCallbacks = {
  onReadyForServerApproval: (paymentId: string) => Promise<void> | void;
  onReadyForServerCompletion: (paymentId: string) => Promise<void> | void;
  onCancel: (paymentId: string) => void;
  onError: (error: unknown, paymentId: string) => void;
};

type PiAuthUser = { username: string; wallet_address: string; uid?: string };

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

export async function createPayment(amount: number, memo: string, metadata: Record<string, unknown> = {}) {
  if (!window.Pi) {
    alert('Please open in Pi Browser.');
    return;
  }
  const paymentData = { amount, memo, metadata };
  const backend = import.meta.env.VITE_BACKEND_URL || (process.env as any)?.NEXT_PUBLIC_BACKEND_URL || '';

  const callbacks: PaymentCallbacks = {
    onReadyForServerApproval: async (paymentId: string) => {
      try {
        if (backend) await axios.post(`${backend}/payments/approve`, { paymentId });
      } catch (e) {
        console.warn('approve failed (continuing):', e);
      }
    },
    onReadyForServerCompletion: async (paymentId: string) => {
      try {
        if (backend) await axios.post(`${backend}/payments/complete`, { paymentId, txid: 'stub-txid' });
      } catch (e) {
        console.warn('complete failed (continuing):', e);
      }
    },
    onCancel: (paymentId: string) => {
      console.warn('Payment cancelled:', paymentId);
    },
    onError: (error: unknown, paymentId: string) => {
      console.error('Payment error:', paymentId, error);
    },
  };

  try {
    await window.Pi.createPayment(paymentData, callbacks);
  } catch (e) {
    console.error('Payment exception:', e);
  }
}
