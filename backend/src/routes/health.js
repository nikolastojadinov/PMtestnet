import { Router } from 'express';
import { getSupabase } from '../lib/supabase.js';

export const router = Router();

router.get('/', async (_req, res) => {
  try {
    const sb = getSupabase();
    // light-weight check: call a trivial rpc or just confirm instance exists
    if (!sb) throw new Error('Supabase not ready');
    res.json({ ok: true, db: 'ready' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
