// frontend/src/lib/pi.js
// Pi Network SDK integration wrapper (v2.0) with guarded initialization.
// NOTE: The official package '@pi-network/pi-sdk' may not be published on npm for all environments.
// We rely on the global Pi object injected by the Pi Browser (or loaded via script) when present.

export function isPiBrowser() {
  if (typeof window === 'undefined') return false;
  return window.name === 'PiBrowser' || /PiBrowser/i.test(navigator.userAgent || '');
}

let sdkInitPromise = null;
let initialized = false;

export async function initPiSDK() {
  if (!isPiBrowser()) {
    console.warn('[Pi] Not in Pi Browser – SDK init skipped');
    return false;
  }
  if (initialized) return true;
  if (sdkInitPromise) return sdkInitPromise;
  sdkInitPromise = (async () => {
    // Attempt to load script if Pi not present
    if (!window.Pi) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://sdk.minepi.com/pi-sdk.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Pi SDK script'));
        document.head.appendChild(script);
      }).catch(e => { console.error('[Pi] Script load error', e); });
    }
    if (!window.Pi) {
      console.warn('[Pi] Pi object still missing after script load');
      return false;
    }
    try {
      if (!window.Pi._initialized) {
        window.Pi.init({ version: '2.0', sandbox: true, appId: (import.meta.env.NEXT_PUBLIC_PI_APP_ID || import.meta.env.VITE_PI_APP_ID) });
        window.Pi._initialized = true;
        console.log('[Pi] SDK initialized (v2.0)');
      }
      initialized = true;
      return true;
    } catch (e) {
      console.error('[Pi] init error', e);
      return false;
    }
  })();
  return sdkInitPromise;
}

function requirePi() {
  if (!window.Pi) throw new Error('Pi SDK not available');
  return window.Pi;
}

export async function authenticateUser() {
  await initPiSDK();
  const Pi = requirePi();
  const onIncompletePaymentFound = (payment) => {
    console.warn('[Pi] Incomplete payment found', payment);
  };
  try {
    const authResult = await Pi.authenticate(['username', 'payments', 'wallet_address'], onIncompletePaymentFound);
    const user = authResult?.user || {};
    console.log('[Pi] Auth success', user?.username, user?.uid);
    return {
      username: user?.username || null,
      uid: user?.uid || null,
      wallet: user?.wallet_address || null,
      accessToken: authResult?.accessToken || null,
    };
  } catch (e) {
    console.error('[Pi] Auth failed', e);
    throw e;
  }
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
