// frontend/src/lib/piPayments.ts
// Typed Pi Network Payments v2 wrapper.

type Plan = 'weekly' | 'monthly' | 'yearly';

const PLAN_PRICING: Record<Plan, { amount: number; days: number; memo: string }> = {
  weekly: { amount: 1, days: 7, memo: 'PurpleMusic Weekly Premium' },
  monthly: { amount: 3.14, days: 30, memo: 'PurpleMusic Monthly Premium' },
  yearly: { amount: 31.4, days: 365, memo: 'PurpleMusic Yearly Premium' },
};

interface StartPaymentResult {
  ok: boolean;
  premium_until?: string;
  error?: string;
}

interface StartPaymentOptions {
  locale: string;
  appVersion?: string;
  backendBase?: string; // override for testing
}

declare global {
  interface Window { Pi?: any }
}

function ensurePi(): any {
  if (!window.Pi) throw new Error('Pi SDK not detected. Open inside Pi Browser.');
  if (!window.Pi._initialized) {
    try { window.Pi.init({ version: '2.0' }); window.Pi._initialized = true; } catch (e) { /* ignore */ }
  }
  return window.Pi;
}

async function postJSON(url: string, body: any): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export async function startPayment(plan: Plan, opts: StartPaymentOptions): Promise<StartPaymentResult> {
  try {
    const Pi = ensurePi();
    const pricing = PLAN_PRICING[plan];
    if (!pricing) return { ok: false, error: 'Invalid plan' };
    const backend = opts.backendBase || (import.meta.env.VITE_BACKEND_URL || import.meta.env.NEXT_PUBLIC_BACKEND_URL);
    if (!backend) return { ok: false, error: 'Missing backend URL env (VITE_BACKEND_URL)' };

    const paymentData = {
      amount: pricing.amount,
      memo: pricing.memo,
      metadata: { plan, locale: opts.locale, appVersion: opts.appVersion || '0.0.0' },
    };

    return await new Promise<StartPaymentResult>((resolve) => {
      let approved = false;
      Pi.createPayment(paymentData, {
        onReadyForServerApproval: async (paymentId: string) => {
          try {
            await postJSON(`${backend}/payments/approve`, { paymentId });
            approved = true;
          } catch (e: any) {
            resolve({ ok: false, error: 'Approval failed: ' + (e.message || e) });
          }
        },
        onReadyForServerCompletion: async (paymentId: string, txid: string) => {
          try {
            const r = await postJSON(`${backend}/payments/complete`, { paymentId, txid });
            resolve({ ok: true, premium_until: r.premium_until });
          } catch (e: any) {
            resolve({ ok: false, error: 'Completion failed: ' + (e.message || e) });
          }
        },
        onCancel: () => {
          if (!approved) resolve({ ok: false, error: 'Payment cancelled' });
        },
        onError: (err: any) => {
          resolve({ ok: false, error: 'Payment error: ' + (err?.message || String(err)) });
        }
      });
    });
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) };
  }
}

export function planLabel(plan: Plan, t: (k: string)=>string): string {
  switch (plan) {
    case 'weekly': return t('weekly_plan') || 'Weekly Plan';
    case 'monthly': return t('monthly_plan') || 'Monthly Plan';
    case 'yearly': return t('yearly_plan') || 'Yearly Plan';
  }
}

export function formatIsoDate(iso?: string, locale?: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString(locale || 'en'); } catch { return iso.slice(0,10); }
}
