// frontend/src/lib/pi.js
// Pi Network SDK integration wrapper adapted to official demo pattern.
// Assumes index.html has already loaded https://sdk.minepi.com/pi-sdk.js and called Pi.init.

export function isPiBrowser() {
  if (typeof window === 'undefined') return false;
  return window.name === 'PiBrowser' || /PiBrowser/i.test(navigator.userAgent || '');
}

let sdkInitPromise = null;
let initialized = false;

export async function initPiSDK() {
  if (!isPiBrowser()) return false;
  if (initialized) return true;
  if (!window.Pi) {
    console.warn('[Pi] Pi SDK not present (script tag failed?)');
    return false;
  }
  try {
    if (!window.Pi._initialized) {
      const sandbox = true; // keep sandbox while testing
      window.Pi.init({ version: '2.0', sandbox, appId: (import.meta.env.NEXT_PUBLIC_PI_APP_ID || import.meta.env.VITE_PI_APP_ID) });
      window.Pi._initialized = true;
      console.log('[Pi] SDK confirmed initialized');
    }
    initialized = true;
    return true;
  } catch (e) {
    console.error('[Pi] init error', e);
    return false;
  }
}

function requirePi() {
  if (!window.Pi) throw new Error('Pi SDK not available');
  return window.Pi;
}

export async function authenticateUser() {
  await initPiSDK();
  const Pi = requirePi();
  const scopes = ['username', 'payments', 'wallet_address'];
  const onIncompletePaymentFound = (payment) => {
    console.log('[Pi] onIncompletePaymentFound', payment?.identifier || payment);
  };
  const authResult = await Pi.authenticate(scopes, onIncompletePaymentFound);
  const user = authResult?.user || {};
  return {
    username: user?.username || null,
    uid: user?.uid || null,
    wallet: user?.wallet_address || null,
    accessToken: authResult?.accessToken || null,
  };
}

const BACKEND_URL = (import.meta.env.NEXT_PUBLIC_BACKEND_URL || import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

export async function createPiPayment({ amount = 0.01, memo = 'Test Payment', metadata = {} } = {}) {
  await initPiSDK();
  const Pi = requirePi();
  console.log('[Pi] Payment created');
  return new Promise((resolve, reject) => {
    try {
      Pi.createPayment({ amount, memo, metadata }, {
        onReadyForServerApproval: async (paymentId) => {
          try {
            if (!BACKEND_URL) console.warn('[Pi] Missing BACKEND_URL, skipping /payments/approve');
            console.log('[Pi] Calling /payments/approve...');
            await fetch(`${BACKEND_URL}/payments/approve`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId })
            });
            console.log('[Pi] Payment approved');
          } catch (e) {
            console.error('[Pi] approve failed', e);
          }
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          try {
            if (!BACKEND_URL) console.warn('[Pi] Missing BACKEND_URL, skipping /payments/complete');
            console.log('[Pi] Calling /payments/complete...');
            await fetch(`${BACKEND_URL}/payments/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentId, txid })
            });
            console.log('[Pi] Payment completed successfully');
            resolve({ status: 'completed', paymentId, txid });
          } catch (e) {
            console.error('[Pi] complete failed', e);
            reject(e);
          }
        },
        onCancel: (paymentId) => {
          console.warn('[Pi] Payment cancelled', paymentId);
          reject(new Error('Payment cancelled'));
        },
        onError: (error, payment) => {
          console.error('[Pi] Payment error', error, payment);
          reject(error || new Error('Unknown payment error'));
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function piStatus() { return { isPiBrowser: isPiBrowser(), initialized }; }
