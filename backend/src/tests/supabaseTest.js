import { initSupabase, getSupabase } from '../lib/supabase.js';
await initSupabase();
const sb = getSupabase();
console.log('[test] supabase client ok:', !!sb);
process.exit(0);
