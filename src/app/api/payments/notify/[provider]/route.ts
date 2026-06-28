import OrderPaid from 'emails/OrderPaid';
import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { formatMoney, money } from '@/domain/money';
import { MockProvider } from '@/domain/payment/adapters/MockProvider';
import type { VerifiedEvent } from '@/domain/payment/ChargeInput';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';
import { isFresh } from '@/lib/webhook/freshness';

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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
      .select('variant_id, qty, product_snapshot')
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

    // Confirmation email — best-effort; never block the paid transition on it.
    try {
      const locale = order.locale === 'th' ? 'th' : 'en';
      const emailItems = (items ?? []).map((it) => {
        const snap = it.product_snapshot as { name?: { th?: string; en?: string } } | null;
        const name = snap?.name?.[locale] ?? snap?.name?.en ?? snap?.name?.th ?? 'item';
        return { name, qty: it.qty };
      });
      const orderUrl = `${siteUrl()}/${locale}/order/${order.id}?t=${signOrderToken(order.id, order.customer_email)}`;
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
      console.error('[payments/notify] confirmation email failed', err);
    }
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
