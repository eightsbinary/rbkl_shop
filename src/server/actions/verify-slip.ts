'use server';

import SlipRejected from 'emails/SlipRejected';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';
import { markOrderPaid } from '@/server/orders/mark-paid';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
type Result = { ok: true } | { error: string };

export async function approveSlip(orderId: string): Promise<Result> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const svc = createServiceRoleSupabase();
  const { data: order } = await svc
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .maybeSingle();
  if (order?.status !== 'awaiting_verification')
    return { error: 'Order not awaiting verification' };

  await markOrderPaid(svc, orderId, { actor: 'owner' });
  await svc
    .from('payment_slips')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .eq('status', 'pending');
  return { ok: true };
}

export async function rejectSlip(orderId: string, reason: string): Promise<Result> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;
  const trimmed = reason.trim();
  if (!trimmed) return { error: 'A reason is required' };

  const svc = createServiceRoleSupabase();
  const { data: order } = await svc
    .from('orders')
    .select('id, status, number, customer_email, locale')
    .eq('id', orderId)
    .maybeSingle();
  if (order?.status !== 'awaiting_verification')
    return { error: 'Order not awaiting verification' };

  await svc
    .from('payment_slips')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reject_reason: trimmed })
    .eq('order_id', orderId)
    .eq('status', 'pending');
  await svc.from('orders').update({ status: 'awaiting_payment' }).eq('id', orderId);
  await svc.from('order_events').insert({
    order_id: orderId,
    type: 'payment.slip_rejected',
    payload: { reason: trimmed },
    actor: 'owner',
  });

  try {
    const locale = order.locale === 'th' ? 'th' : 'en';
    const orderUrl = `${siteUrl()}/${locale}/order/${orderId}?t=${signOrderToken(orderId, order.customer_email)}`;
    await sendEmail({
      to: order.customer_email,
      subject: `Action needed — order ${order.number}`,
      react: SlipRejected({ orderNumber: order.number, orderUrl, reason: trimmed }),
    });
  } catch (err) {
    console.error('[rejectSlip] email failed', err);
  }
  return { ok: true };
}
