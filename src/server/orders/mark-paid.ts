import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import OrderPaid from 'emails/OrderPaid';
import type { Database } from '@/db/types.gen';
import { formatMoney, money } from '@/domain/money';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** The post-verification "order is paid" transition, shared by the PSP webhook
 *  (FFP later) and the manual slip approval. Idempotent: a no-op if already paid.
 *  Sets paid/paid_at/ship_status, releases reserved stock, logs an event, emails. */
export async function markOrderPaid(
  supa: SupabaseClient<Database>,
  orderId: string,
  opts: { actor?: string } = {},
): Promise<void> {
  const actor = opts.actor ?? 'system';
  const { data: order } = await supa
    .from('orders')
    .select('id, status, total_thb, number, customer_email, locale')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.status === 'paid') return;

  await supa
    .from('orders')
    .update({ status: 'paid', paid_at: new Date().toISOString(), ship_status: 'preparing' })
    .eq('id', orderId);

  const { data: items } = await supa
    .from('order_items')
    .select('variant_id, qty, product_snapshot')
    .eq('order_id', orderId);

  for (const it of items ?? []) {
    if (!it.variant_id) continue;
    const { data: v } = await supa
      .from('variants')
      .select('stock_reserved')
      .eq('id', it.variant_id)
      .maybeSingle();
    if (v) {
      await supa
        .from('variants')
        .update({ stock_reserved: Math.max(0, v.stock_reserved - it.qty) })
        .eq('id', it.variant_id);
    }
  }

  await supa
    .from('order_events')
    .insert({ order_id: orderId, type: 'payment.paid', payload: { actor }, actor });

  try {
    const locale = order.locale === 'th' ? 'th' : 'en';
    const emailItems = (items ?? []).map((it) => {
      const snap = it.product_snapshot as { name?: { th?: string; en?: string } } | null;
      return {
        name: snap?.name?.[locale] ?? snap?.name?.en ?? snap?.name?.th ?? 'item',
        qty: it.qty,
      };
    });
    const orderUrl = `${siteUrl()}/${locale}/order/${orderId}?t=${signOrderToken(orderId, order.customer_email)}`;
    await sendEmail({
      to: order.customer_email,
      subject: `Payment received — order ${order.number}`,
      react: OrderPaid({
        orderNumber: order.number,
        orderUrl,
        items: emailItems,
        totalLabel: formatMoney(money(order.total_thb), locale),
      }),
    });
  } catch (err) {
    console.error('[markOrderPaid] confirmation email failed', err);
  }
}
