'use server';

import { redirect } from 'next/navigation';
import { createServiceRoleSupabase } from '@/db/server';
import { signOrderToken } from '@/lib/order-token';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';

export type TrackError = 'notFound' | 'verifyFailed' | 'rateLimited';
export type TrackResult = { error: TrackError };

/**
 * Public order lookup. Given an order number + email, verifies the pair against
 * the order's `customer_email` (service-role read, bypassing RLS) and, on an
 * exact match, mints a fresh token and redirects to the existing token-gated
 * order page.
 *
 * Anti-enumeration: a missing order number and a mismatched email return the
 * SAME generic `notFound` — the caller can never tell which was wrong. Guarded
 * by per-IP rate limiting and Turnstile, consistent with checkout/login.
 */
export async function lookupOrder(
  _prev: TrackResult | null,
  formData: FormData,
): Promise<TrackResult> {
  const number = String(formData.get('number') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const localeRaw = String(formData.get('locale') ?? 'en');
  const locale = localeRaw === 'th' ? 'th' : 'en';
  if (!number || !email) return { error: 'notFound' };

  const ip = await clientIp();
  const token = String(formData.get('turnstileToken') ?? '');
  const rl = await enforceRateLimit('order-lookup-ip', ip, { max: 10, windowMs: 600_000 });
  if (!rl.ok) return { error: 'rateLimited' };
  if (!(await verifyTurnstile(token, ip))) return { error: 'verifyFailed' };

  const supa = createServiceRoleSupabase();
  const { data: order } = await supa
    .from('orders')
    .select('id, customer_email')
    .eq('number', number)
    .maybeSingle();

  // Identical result whether the number is missing or the email mismatches.
  if (!order || order.customer_email.toLowerCase() !== email.toLowerCase()) {
    return { error: 'notFound' };
  }

  const orderToken = signOrderToken(order.id, email);
  redirect(`/${locale}/order/${order.id}?t=${orderToken}`);
}
