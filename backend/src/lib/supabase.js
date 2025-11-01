// ✅ FULL REWRITE v3.7 — Supabase client configuration

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
// Prefer service role on the backend; fall back to anon if explicitly configured
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (!supabaseUrl || !supabaseKey) {
  console.error('[supabase] ❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE (or ANON) environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ✅ eksport kao default (da se importuje bez viticastih zagrada)
export default supabase;
