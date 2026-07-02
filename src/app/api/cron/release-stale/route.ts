import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { STALE_HOLD_MINUTES } from '@/domain/stale-orders';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

/**
 * Release reserved stock for orders stuck in `awaiting_payment` past the hold
 * window, cancelling them so the catalog doesn't bleed inventory.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceRoleSupabase();
  const cutoff = new Date(Date.now() - STALE_HOLD_MINUTES * 60_000).toISOString();

  const { data: stale } = await svc
    .from('orders')
    .select('id')
    .eq('status', 'awaiting_payment')
    .lt('created_at', cutoff);

  let released = 0;
  for (const order of stale ?? []) {
    const { data: items } = await svc
      .from('order_items')
      .select('variant_id, qty')
      .eq('order_id', order.id);

    for (const it of items ?? []) {
      if (!it.variant_id) continue;
      const { data: v } = await svc
        .from('variants')
        .select('stock_available, stock_reserved')
        .eq('id', it.variant_id)
        .maybeSingle();
      if (v) {
        await svc
          .from('variants')
          .update({
            stock_available: v.stock_available + it.qty,
            stock_reserved: Math.max(0, v.stock_reserved - it.qty),
          })
          .eq('id', it.variant_id);
      }
    }

    await svc.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    await svc.from('order_events').insert({
      order_id: order.id,
      type: 'order.cancelled_stale',
      payload: { reason: 'hold_expired' },
      actor: 'system',
    });
    released += 1;
  }

  return NextResponse.json({ ok: true, released });
}
