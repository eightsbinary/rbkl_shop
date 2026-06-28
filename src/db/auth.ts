import type { SupabaseClient } from '@supabase/supabase-js';
import { STEP_UP_REQUIRED, STEP_UP_WINDOW_MS } from '@/lib/step-up';
import type { Database } from './types.gen';

type Client = SupabaseClient<Database>;
export type Role = Database['public']['Enums']['user_role'];

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function getCurrentRole(client: Client): Promise<Role | null> {
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await client
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return data.role as Role;
}

export async function requireOwnerOrDev(client: Client): Promise<void> {
  const role = await getCurrentRole(client);
  if (role !== 'owner' && role !== 'dev') {
    throw new ForbiddenError('Requires owner or dev');
  }
}

export async function requireDev(client: Client): Promise<void> {
  const role = await getCurrentRole(client);
  if (role !== 'dev') {
    throw new ForbiddenError('Requires dev');
  }
}

export class StepUpRequiredError extends Error {
  constructor(message = 'Step-up authentication required') {
    super(message);
    this.name = 'StepUpRequiredError';
  }
}

/** Throws StepUpRequiredError unless the user interactively signed in within
 *  windowMs. Supabase only bumps last_sign_in_at on an actual sign-in, not on
 *  token refresh, so it is a reliable recency signal. */
export async function requireRecentAuth(
  client: Client,
  windowMs: number,
  now: () => number = () => Date.now(),
): Promise<void> {
  const { data } = await client.auth.getUser();
  const lastSignIn = data.user?.last_sign_in_at;
  if (!lastSignIn) throw new StepUpRequiredError();
  if (now() - Date.parse(lastSignIn) > windowMs) throw new StepUpRequiredError();
}

/** Action-friendly wrapper: returns the step-up sentinel result, or null when
 *  the session is recent enough. Bypassed outside production — consistent with
 *  the Turnstile / rate-limit dev fallbacks, and keeps local admin frictionless. */
export async function stepUpGuard(client: Client): Promise<{ error: string } | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  try {
    await requireRecentAuth(client, STEP_UP_WINDOW_MS);
    return null;
  } catch (e) {
    if (e instanceof StepUpRequiredError) return { error: STEP_UP_REQUIRED };
    throw e;
  }
}
