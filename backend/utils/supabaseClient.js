import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[FATAL] Supabase credentials missing. Check .env');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
console.log('[OK] Supabase client initialized');
