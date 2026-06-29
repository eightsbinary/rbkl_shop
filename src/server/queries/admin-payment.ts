import 'server-only';
import { createServiceRoleSupabase } from '@/db/server';

export interface SlipReview {
  slipId: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: string;
  imageUrl: string | null;
  rejectReason: string | null;
}

/** Latest slip for an order + a short-lived signed download URL (private bucket). */
export async function getOrderSlipReview(orderId: string): Promise<SlipReview | null> {
  const supa = createServiceRoleSupabase();
  const { data: slip } = await supa
    .from('payment_slips')
    .select('id, status, uploaded_at, storage_path, reject_reason')
    .eq('order_id', orderId)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!slip) return null;
  const { data: signed } = await supa.storage
    .from('payment-slips')
    .createSignedUrl(slip.storage_path, 600);
  return {
    slipId: slip.id,
    status: slip.status as SlipReview['status'],
    uploadedAt: slip.uploaded_at,
    imageUrl: signed?.signedUrl ?? null,
    rejectReason: slip.reject_reason,
  };
}
