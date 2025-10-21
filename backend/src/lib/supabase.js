// backend/src/lib/supabase.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure .env is loaded even when Render changes working directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from backend folder
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Diagnostic check — shows if env variables are visible
console.log('[env-check]', {
  SUPABASE_URL: process.env.SUPABASE_URL || 'MISSING',
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE ? '***present***' : 'MISSING'
});

let supabase = null;

export function isSupabaseReady() {
  return !!supabase;
}

export function getSupabase() {
  if (!supabase) throw new Error('Supabase not initialized yet.');
  return supabase;
}

export async function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !key) {
    console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE; starting without DB.');
    return false;
  }

  supabase = createClient(url, key, {
    auth: { persistSession: false },
    global: { headers: { 'x-client-info': 'pmtestnet-backend' } }
  });

  console.log('[supabase] client initialized');
  return true;
}
