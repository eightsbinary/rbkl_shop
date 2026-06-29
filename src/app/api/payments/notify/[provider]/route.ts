import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { MockProvider } from '@/domain/payment/adapters/MockProvider';
import type { VerifiedEvent } from '@/domain/payment/ChargeInput';
import { isFresh } from '@/lib/webhook/freshness';
import { markOrderPaid } from '@/server/orders/mark-paid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerKey } = await params;
  if (providerKey !== 'mock') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }
  const provider = new MockProvider();

  let event: VerifiedEvent;
  try {
    event = await provider.verifyNotification(request.clone());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Bad signature' },
      { status: 400 },
    );
  }

  if (!isFresh(event.occurredAt, Date.now(), 5 * 60_000)) {
    return NextResponse.json({ error: 'Stale event' }, { status: 400 });
  }

  const supa = createServiceRoleSupabase();
  const { data: order } = await supa
    .from('orders')
    .select('id, status, total_thb, last_event_id, number, customer_email, locale')
    .eq('id', event.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'Unknown order' }, { status: 404 });

  // Order-level idempotency: only an awaiting-payment order accepts a paid/failed
  // transition. A second distinct event for an already-terminal order is skipped
  // (no double stock decrement / duplicate email). Exotic late captures after a
  // terminal status are intentionally not reconciled here — that's the real PSP
  // adapter's job (Plan 6c).
  if (order.status !== 'awaiting_payment') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (order.total_thb !== event.amountThb) {
    return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
  }

  // Atomic, durable dedup: the unique (provider, event_id) constraint makes a
  // concurrent or replayed delivery fail with 23505 instead of double-processing.
  const { error: dedupError } = await supa
    .from('processed_webhook_events')
    .insert({ provider: providerKey, event_id: event.eventId, order_id: order.id });
  if (dedupError) {
    if (dedupError.code === '23505') {
      return NextResponse.json({ ok: true, dedup: true });
    }
    return NextResponse.json({ error: 'Could not record event' }, { status: 500 });
  }

  if (event.status === 'paid') {
    await markOrderPaid(supa, order.id, { actor: 'system' });
    await supa.from('orders').update({ last_event_id: event.eventId }).eq('id', order.id);
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
      .select('variant_id, qty, is_preorder')
      .eq('order_id', order.id);
    for (const it of items ?? []) {
      if (!it.variant_id) continue;
      const { data: v } = await supa
        .from('variants')
        .select('stock_available, stock_reserved, preorder_count')
        .eq('id', it.variant_id)
        .maybeSingle();
      if (!v) continue;
      if (it.is_preorder) {
        await supa
          .from('variants')
          .update({ preorder_count: Math.max(0, v.preorder_count - it.qty) })
          .eq('id', it.variant_id);
      } else {
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
