'use server';

import SlipReceived from 'emails/SlipReceived';
import { createServiceRoleSupabase } from '@/db/server';
import { sendEmail } from '@/lib/email';
import { verifyOrderToken } from '@/lib/order-token';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function submitSlip(input: {
  orderId: string;
  token: string;
  storagePath: string;
}): Promise<{ ok: true } | { error: string }> {
  const supa = createServiceRoleSupabase();

  const { data: order } = await supa
    .from('orders')
    .select('id, status, number, customer_email, locale')
    .eq('id', input.orderId)
    .maybeSingle();
  // Token is HMAC-bound to (orderId, email) — verify against the order's email.
  if (!order || !verifyOrderToken(input.token, input.orderId, order.customer_email)) {
    return { error: 'Unauthorized' };
  }
  if (order.status !== 'awaiting_payment' && order.status !== 'awaiting_verification') {
    return { error: 'Order not awaiting payment' };
  }

  await supa.from('payment_slips').insert({ order_id: order.id, storage_path: input.storagePath });
  await supa.from('orders').update({ status: 'awaiting_verification' }).eq('id', order.id);
  await supa.from('order_events').insert({
    order_id: order.id,
    type: 'payment.slip_submitted',
    payload: { path: input.storagePath },
    actor: 'customer',
  });

  try {
    const locale = order.locale === 'th' ? 'th' : 'en';
    const orderUrl = `${siteUrl()}/${locale}/order/${order.id}?t=${input.token}`;
    await sendEmail({
      to: order.customer_email,
      subject: `Slip received — order ${order.number}`,
      react: SlipReceived({ orderNumber: order.number, orderUrl }),
    });
  } catch (err) {
    console.error('[submitSlip] email failed', err);
  }
  return { ok: true };
}
