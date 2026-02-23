import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return '';
  return url;
}

function getSupabaseServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return '';
  return key;
}

/**
 * Service-role client that bypasses RLS.
 * Use only in Server Actions / Route Handlers — never expose to the client.
 */
export function createSupabaseServerClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
