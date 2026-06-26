import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { MockProvider } from '@/domain/payment/adapters/MockProvider';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerKey } = await params;
  if (providerKey !== 'mock') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }
  const provider = new MockProvider();

  let event;
  try {
    event = await provider.verifyNotification(request.clone());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bad signature' },
      { status: 400 },
    );
  }

  const supa = createServiceRoleSupabase();
  const { data: order } = await supa
    .from('orders')
    .select('id, status, total_thb, last_event_id')
    .eq('id', event.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Unknown order' }, { status: 404 });
  if (order.last_event_id === event.eventId) {
    return NextResponse.json({ ok: true, dedup: true });
  }
  if (order.total_thb !== event.amountThb) {
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  if (event.status === 'paid') {
    await supa
      .from('orders')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        last_event_id: event.eventId,
        ship_status: 'preparing',
      })
      .eq('id', order.id);

    const { data: items } = await supa
      .from('order_items')
      .select('variant_id, qty')
      .eq('order_id', order.id);
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
    await supa.from('order_events').insert({
      order_id: order.id,
      type: 'payment.paid',
      payload: { eventId: event.eventId, chargeId: event.chargeId },
      actor: 'system',
    });
  } else if (event.status === 'failed' || event.status === 'expired') {
    await supa
      .from('orders')
      .update({
        status: event.status === 'failed' ? 'failed' : 'cancelled',
        last_event_id: event.eventId,
      })
      .eq('id', order.id);

    const { data: items } = await supa
      .from('order_items')
      .select('variant_id, qty')
      .eq('order_id', order.id);
    for (const it of items ?? []) {
      if (!it.variant_id) continue;
      const { data: v } = await supa
        .from('variants')
        .select('stock_available, stock_reserved')
        .eq('id', it.variant_id)
        .maybeSingle();
      if (v) {
        await supa
          .from('variants')
          .update({
            stock_available: v.stock_available + it.qty,
            stock_reserved: Math.max(0, v.stock_reserved - it.qty),
          })
          .eq('id', it.variant_id);
      }
    }
    await supa.from('order_events').insert({
      order_id: order.id,
      type: 'payment.failed',
      payload: { eventId: event.eventId, chargeId: event.chargeId },
      actor: 'system',
    });
  }

  return NextResponse.json({ ok: true });
}
