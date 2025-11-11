import express from 'express';
import { supabase } from '../lib/supabase.js';

// Official Pi user sync router
// Responsibilities:
//  - Upsert user by wallet (preferred) or username fallback
//  - Maintain last_login timestamp
//  - Ensure user_consent flag true once first sync occurs
//  - Accept uid (Pi unique user id) for association

export const usersRouter = express.Router();

usersRouter.post('/sync', async (req, res) => {
  try {
    const { username, wallet_address, uid } = req.body || {};
    if (!username || !wallet_address) {
      return res.status(400).json({ error: 'Missing username or wallet_address' });
    }

    // Attempt select by wallet (preferred unique identifier)
    const { data: existing, error: selErr } = await supabase
      .from('users')
      .select('id')
      .eq('wallet', wallet_address)
      .maybeSingle();
    if (selErr) return res.status(500).json({ error: selErr.message });

    const now = new Date().toISOString();
    if (existing?.id) {
      const { error: updErr } = await supabase
        .from('users')
        .update({
          last_login: now,
          pi_uid: uid || null,
          username, // keep most recent username (in case of rename)
          user_consent: true,
        })
        .eq('id', existing.id);
      if (updErr) return res.status(500).json({ error: updErr.message });
      return res.json({ success: true, mode: 'update' });
    }

    // Insert new record
    const insertRow = {
      username,
      wallet: wallet_address,
      pi_uid: uid || null,
      user_consent: true,
      last_login: now, // schema currently lacks column; kept for forward compatibility if added
      created_at: now,
      language: 'en',
      country: 'GLOBAL',
      premium_until: null,
    };

    // Remove last_login if column not present (schema does not define it now)
    delete insertRow.last_login;

    const { error: insErr } = await supabase.from('users').insert(insertRow);
    if (insErr) return res.status(500).json({ error: insErr.message });
    return res.json({ success: true, mode: 'insert' });
  } catch (err) {
    console.error('User sync error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }
});

export default usersRouter;