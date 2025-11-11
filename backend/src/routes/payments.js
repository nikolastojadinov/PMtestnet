// backend/src/routes/payments.js
// Official Pi Platform approval/complete proxy routes
import express from 'express';

export const paymentsRouter = express.Router();

const PI_API_KEY = process.env.PI_API_KEY;
const PI_API_BASE = 'https://api.minepi.com/v2/payments';

function requireKey(res) {
  if (!PI_API_KEY) {
    res.status(500).json({ error: 'Missing PI_API_KEY' });
    return false;
  }
  return true;
}

paymentsRouter.post('/approve', express.json(), async (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });
  if (!requireKey(res)) return;
  try {
    const response = await fetch(`${PI_API_BASE}/${paymentId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Key ${PI_API_KEY}` },
    });
    const result = await response.json();
    return res.json(result);
  } catch (e) {
    console.error('Approve error:', e);
    return res.status(500).json({ error: 'Approve failed' });
  }
});

paymentsRouter.post('/complete', express.json(), async (req, res) => {
  const { paymentId } = req.body || {};
  if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });
  if (!requireKey(res)) return;
  try {
    const response = await fetch(`${PI_API_BASE}/${paymentId}/complete`, {
      method: 'POST',
      headers: { Authorization: `Key ${PI_API_KEY}` },
    });
    const result = await response.json();
    return res.json(result);
  } catch (e) {
    console.error('Complete error:', e);
    return res.status(500).json({ error: 'Complete failed' });
  }
});

export default paymentsRouter;
