import 'server-only';
import { createServerSupabase } from '@/db/server';

export interface PaymentSettings {
  qrUrl: string | null;
  accountLabel: string | null;
  instructions: { th?: string; en?: string };
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('payment_settings')
    .select('promptpay_qr_path, account_label, instructions')
    .eq('id', 'singleton')
    .maybeSingle();
  const qrUrl = data?.promptpay_qr_path
    ? supa.storage.from('payment-assets').getPublicUrl(data.promptpay_qr_path).data.publicUrl
    : null;
  return {
    qrUrl,
    accountLabel: data?.account_label ?? null,
    instructions: (data?.instructions as { th?: string; en?: string }) ?? {},
  };
}
