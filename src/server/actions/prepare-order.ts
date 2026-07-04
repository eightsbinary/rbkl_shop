'use server';

import PreorderPreparing, { subject as preparingSubject } from 'emails/PreorderPreparing';
import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/**
 * Pre-order stock arrived: move the order from awaiting_stock to preparing and
 * tell the buyer. The update is scoped to ship_status = awaiting_stock so a
 * double-click or a stale page can't re-fire the transition (and its email).
 */
export async function startPreparing(orderId: string) {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const svc = createServiceRoleSupabase();
  const { data: updated } = await svc
    .from('orders')
    .update({ ship_status: 'preparing' })
    .eq('id', orderId)
    .eq('ship_status', 'awaiting_stock')
    .select('id, customer_email, locale, number')
    .maybeSingle();
  if (!updated) return { error: 'Order is not awaiting stock' };

  await svc.from('order_events').insert({
    order_id: updated.id,
    type: 'order.preparing',
    payload: {},
    actor: 'owner',
  });

  try {
    const locale = updated.locale === 'th' ? 'th' : 'en';
    const orderUrl = `${siteUrl()}/${locale}/order/${updated.id}?t=${signOrderToken(updated.id, updated.customer_email)}`;
    await sendEmail({
      to: updated.customer_email,
      subject: preparingSubject(locale, updated.number),
      react: PreorderPreparing({ locale, orderNumber: updated.number, orderUrl }),
    });
  } catch (err) {
    console.error('[startPreparing] preparing email failed', err);
  }

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true as const };
}
