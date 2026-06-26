import type { SupabaseClient } from '@supabase/supabase-js';
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
