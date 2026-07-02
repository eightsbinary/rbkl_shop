'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';

export async function saveEmailProvider(
  provider: string,
): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  if (provider !== 'gmail' && provider !== 'resend') {
    return { error: 'Unknown email provider' };
  }

  const svc = createServiceRoleSupabase();
  const { error } = await svc
    .from('app_settings')
    .update({ email_provider: provider, updated_at: new Date().toISOString() })
    .eq('id', 'singleton');
  if (error) return { error: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}
