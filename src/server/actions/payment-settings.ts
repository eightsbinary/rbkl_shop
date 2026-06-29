'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';

export async function savePaymentSettings(input: {
  promptpayQrPath?: string;
  accountLabel: string;
  instructions: { th?: string; en?: string };
}): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const svc = createServiceRoleSupabase();
  const { error } = await svc
    .from('payment_settings')
    .update({
      account_label: input.accountLabel,
      instructions: input.instructions,
      updated_at: new Date().toISOString(),
      ...(input.promptpayQrPath ? { promptpay_qr_path: input.promptpayQrPath } : {}),
    })
    .eq('id', 'singleton');
  if (error) return { error: error.message };
  revalidatePath('/admin/settings');
  return { ok: true };
}
