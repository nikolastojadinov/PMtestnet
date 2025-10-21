import { Router } from 'express';
import { getSupabase, isSupabaseReady } from '../lib/supabase.js';

export const router = Router();

router.get('/', async (_req, res) => {
  try {
    if (!isSupabaseReady()) {
      return res.json({ ok: true, db: 'not-configured' });
    }
    const sb = getSupabase();
    res.json({ ok: true, db: 'ready' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
