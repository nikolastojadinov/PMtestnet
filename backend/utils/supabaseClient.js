import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Support both backend vars and mistakenly set NEXT_PUBLIC_* as a fallback (warn if fallback used)
const directUrl = process.env.SUPABASE_URL;
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl = directUrl || publicUrl;

const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const supabaseKey = serviceKey || anonKey;

if (!supabaseUrl || !supabaseKey) {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseKey) missing.push('SUPABASE_SERVICE_KEY or SUPABASE_ANON_KEY');
  console.error(`[FATAL] Missing env: ${missing.join(', ')}. Set them in Render → Environment.`);
  process.exit(1);
}

if (!directUrl && publicUrl) {
  console.warn('[WARN] Using NEXT_PUBLIC_SUPABASE_URL for backend. Prefer SUPABASE_URL.');
}
if (!serviceKey && anonKey) {
  console.warn('[WARN] Using SUPABASE_ANON_KEY for backend. Prefer SUPABASE_SERVICE_KEY for writes.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});
console.log('[OK] Supabase client initialized');
