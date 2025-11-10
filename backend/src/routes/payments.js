// backend/src/routes/payments.js
// Express router for Pi Network payment approval & completion.
import { supabase } from '../lib/supabase.js';
import crypto from 'crypto';
import { PI_APP_ID, getPiHeaders } from '../config/piNetwork.js';

import express from 'express';
export const paymentsRouter = express.Router();

// PI_APP_ID & PI_API_KEY warnings handled in config module; getPiHeaders provides Authorization header.

// Map memo -> plan for validation; amounts sanity check performed by refetch (stubbed).
const PLAN_MAP = {
  weekly: { amount: 1, days: 7 },
  monthly: { amount: 3.14, days: 30 },
  yearly: { amount: 31.4, days: 365 },
};

function isoNow() { return new Date().toISOString(); }

// Stub: fetch payment details from Pi server (replace with official API call)
async function fetchPayment(paymentId) {
  // In production call Pi API with headers from getPiHeaders()
  // Return object: { id, app_id, amount, memo, metadata: { plan } , user: { uid } }
  return { id: paymentId, app_id: PI_APP_ID, amount: 0, memo: '', metadata: { plan: 'weekly' }, user: { uid: 'unknown' } }; // minimal stub
}

function extendPremium(currentUntil, days) {
  const now = Date.now();
  let base = now;
  if (currentUntil) {
    const cur = Date.parse(currentUntil);
    if (!Number.isNaN(cur) && cur > now) base = cur; // extend from existing future expiry
  }
  return new Date(base + days * 24 * 3600 * 1000).toISOString();
}

paymentsRouter.post('/approve', express.json(), async (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ ok: false, error: 'Missing paymentId' });
  try {
    const pay = await fetchPayment(paymentId);
    if (!pay || pay.app_id !== PI_APP_ID) return res.status(401).json({ ok: false, error: 'App mismatch' });
    const plan = pay.metadata?.plan;
    if (!PLAN_MAP[plan]) return res.status(400).json({ ok: false, error: 'Unknown plan' });
    // Optionally validate amount vs PLAN_MAP[plan].amount
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

paymentsRouter.post('/complete', express.json(), async (req, res) => {
  const { paymentId, txid } = req.body || {};
  if (!paymentId || !txid) return res.status(400).json({ ok: false, error: 'Missing paymentId or txid' });
  try {
    const pay = await fetchPayment(paymentId);
    if (!pay || pay.app_id !== PI_APP_ID) return res.status(401).json({ ok: false, error: 'App mismatch' });
    const plan = pay.metadata?.plan;
    if (!PLAN_MAP[plan]) return res.status(400).json({ ok: false, error: 'Unknown plan' });

    // Retrieve user by pi_uid
    const pi_uid = pay.user?.uid;
    if (!pi_uid) return res.status(400).json({ ok: false, error: 'Missing user uid in payment' });

    // Fetch existing user
    const { data: existing, error: fetchErr } = await supabase.from('users').select('*').eq('pi_uid', pi_uid).maybeSingle();
    if (fetchErr) return res.status(500).json({ ok: false, error: fetchErr.message });
    if (!existing) return res.status(404).json({ ok: false, error: 'User not found' });

    const premium_until = extendPremium(existing.premium_until, PLAN_MAP[plan].days);
    const { error: updErr } = await supabase.from('users').update({ premium_until }).eq('pi_uid', pi_uid);
    if (updErr) return res.status(500).json({ ok: false, error: updErr.message });

    // Log purchase statistic (best-effort)
    try { await supabase.from('statistics').insert({ action: 'purchase', device: 'pi-browser', meta: { plan, paymentId, txid }, created_at: isoNow() }); } catch {}

    return res.json({ ok: true, premium_until });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});
