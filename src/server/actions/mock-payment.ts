'use server';

import { headers } from 'next/headers';
import { createServiceRoleSupabase } from '@/db/server';
import { signMockEvent } from '@/domain/payment/adapters/MockProvider';
import { signOrderToken } from '@/lib/order-token';

export async function simulateMockPayment(orderId: string, status: 'paid' | 'failed') {
  const supa = createServiceRoleSupabase();
  const { data: order } = await supa
    .from('orders')
    .select('id, total_thb, payment_charge_id, customer_email, locale')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { error: 'Order not found' };
  const body = JSON.stringify({
    eventId: `mock_evt_${Date.now()}`,
    orderId: order.id,
    chargeId: order.payment_charge_id ?? 'mock_unknown',
    status,
    amountThb: order.total_thb,
    occurredAt: Date.now(),
  });
  const sig = signMockEvent(body);
  const h = await headers();
  const origin = h.get('origin') ?? 'http://localhost:3000';
  const res = await fetch(`${origin}/api/payments/notify/mock`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mock-signature': sig },
    body,
  });
  if (!res.ok) return { error: `Notify failed: ${res.status}` };
  return {
    ok: true as const,
    token: signOrderToken(order.id, order.customer_email),
    locale: order.locale as 'th' | 'en',
  };
}
