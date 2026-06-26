import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import type { Database } from './types.gen';

/** Server-side Supabase client. Reads/writes the user session via cookies. RLS enforced. */
export async function createServerSupabase() {
  const e = env();
  const cookieStore = await cookies();
  return createServerClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component where setting cookies is disallowed.
          // Safe to ignore — middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS.
 * NEVER call from any code path that reaches the browser.
 * Use only in: scripts/, app/api/, server actions explicitly gated by dev role.
 */
export function createServiceRoleSupabase() {
  const e = env();
  if (typeof window !== 'undefined') {
    throw new Error('Service role client must not be used in the browser');
  }
  return createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
