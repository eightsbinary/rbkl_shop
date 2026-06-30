'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import type { OrderStatus } from '@/server/queries/admin-orders';

// Only unpaid orders can be cancelled here; paid/shipped go through refunds.
const CANCELLABLE: OrderStatus[] = ['awaiting_payment', 'awaiting_verification'];

/**
 * Admin-cancel an unpaid order: release the reserved stock (or pre-order slot)
 * each line is holding, flip the order to `cancelled`, and log it. Guarded by
 * owner/dev + step-up. Service-role writes, consistent with the other admin
 * order actions and the release-stale cron.
 */
export async function cancelOrder(orderId: string): Promise<{ ok: true } | { error: string }> {
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
  if (!order) return { error: 'Order not found' };
  if (!CANCELLABLE.includes(order.status)) {
    return { error: 'Only unpaid orders can be cancelled.' };
  }

  const { data: items } = await svc
    .from('order_items')
    .select('variant_id, qty, is_preorder')
    .eq('order_id', orderId);

  for (const it of items ?? []) {
    if (!it.variant_id) continue;
    const { data: v } = await svc
      .from('variants')
      .select('stock_available, stock_reserved, preorder_count')
      .eq('id', it.variant_id)
      .maybeSingle();
    if (!v) continue;
    if (it.is_preorder) {
      await svc
        .from('variants')
        .update({ preorder_count: Math.max(0, (v.preorder_count ?? 0) - it.qty) })
        .eq('id', it.variant_id);
    } else {
      await svc
        .from('variants')
        .update({
          stock_available: v.stock_available + it.qty,
          stock_reserved: Math.max(0, v.stock_reserved - it.qty),
        })
        .eq('id', it.variant_id);
    }
  }

  // Guard the transition so a payment landing mid-cancel isn't clobbered.
  const { error } = await svc
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .in('status', CANCELLABLE);
  if (error) return { error: error.message };

  await svc.from('order_events').insert({
    order_id: orderId,
    type: 'order.cancelled',
    payload: { reason: 'admin' },
    actor: 'owner',
  });

  revalidatePath('/admin/orders');
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}
