'use server';

import OrderShipped from 'emails/OrderShipped';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { buildTrackingUrl } from '@/domain/carriers';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const ShipInput = z.object({
  orderId: z.string().uuid(),
  carrier: z.string().min(1),
  trackingNumber: z.string().min(1),
  estimatedDeliveryDate: z.string().optional(),
  notesToBuyer: z.string().optional(),
});

export type ShipOrderInput = z.infer<typeof ShipInput>;

export async function shipOrder(raw: ShipOrderInput) {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const parsed = ShipInput.safeParse(raw);
  if (!parsed.success) return { error: 'Invalid shipping details' };
  const input = parsed.data;

  const svc = createServiceRoleSupabase();
  const trackingUrl = buildTrackingUrl(input.carrier, input.trackingNumber);

  const { data: updated, error } = await svc
    .from('orders')
    .update({
      ship_status: 'shipped',
      shipped_at: new Date().toISOString(),
      tracking_carrier: input.carrier,
      tracking_number: input.trackingNumber,
      tracking_url: trackingUrl,
      estimated_delivery_date: input.estimatedDeliveryDate || null,
      notes_to_buyer: input.notesToBuyer || null,
    })
    .eq('id', input.orderId)
    .select('id, customer_email, locale, number')
    .single();
  if (error || !updated) return { error: error?.message ?? 'Update failed' };

  await svc.from('order_events').insert({
    order_id: updated.id,
    type: 'order.shipped',
    payload: { carrier: input.carrier, number: input.trackingNumber, url: trackingUrl },
    actor: 'owner',
  });

  try {
    const locale = updated.locale === 'th' ? 'th' : 'en';
    const orderUrl = `${siteUrl()}/${locale}/order/${updated.id}?t=${signOrderToken(updated.id, updated.customer_email)}`;
    await sendEmail({
      to: updated.customer_email,
      subject: `Your order ${updated.number} is on the way`,
      react: OrderShipped({
        orderNumber: updated.number,
        carrier: input.carrier,
        trackingNumber: input.trackingNumber,
        trackingUrl,
        orderUrl,
      }),
    });
  } catch (err) {
    console.error('[shipOrder] shipped email failed', err);
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${input.orderId}`);
  return { ok: true as const };
}
