// Deprecated shim: re-export the canonical client from src/utils/supabaseClient
// Ensures any legacy imports continue to work without duplicating logic.
export { supabase, getSupabaseClient } from '@/utils/supabaseClient';
