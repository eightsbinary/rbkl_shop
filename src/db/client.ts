import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types.gen';

/**
 * Browser-side Supabase client. Reads the two public vars via DIRECT static
 * `process.env.NEXT_PUBLIC_*` access so Next inlines them into the client
 * bundle. It deliberately does NOT use the server env validator (`env()`):
 * that validates `process.env` as a whole object — unavailable in the browser —
 * and requires server-only secrets like SUPABASE_SERVICE_ROLE_KEY that never
 * exist client-side, so calling it from the browser always throws.
 */
export function createBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in the client bundle.',
    );
  }
  return createBrowserClient<Database>(url, anonKey);
}
