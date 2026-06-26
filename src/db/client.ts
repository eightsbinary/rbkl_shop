import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';
import type { Database } from './types.gen';

/** Browser-side Supabase client. Safe to use in 'use client' components. */
export function createBrowserSupabase() {
  const e = env();
  return createBrowserClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
