'use server';

import OrderLinks, { subject as orderLinksSubject } from 'emails/OrderLinks';
import { redirect } from 'next/navigation';
import { createServiceRoleSupabase } from '@/db/server';
import { sendEmail } from '@/lib/email';
import { signOrderToken } from '@/lib/order-token';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';
import { verifyTurnstile } from '@/lib/turnstile';

export type TrackError = 'notFound' | 'verifyFailed' | 'rateLimited';
export type TrackResult = { error: TrackError };
export type RecoverResult = { sent: true } | { error: Exclude<TrackError, 'notFound'> };

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

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

const RECOVER_LIMIT = 10;

/**
 * Email-only recovery for buyers who lost their order number: sends a list of
 * their recent orders with token-signed links. ALWAYS answers `{ sent: true }`
 * whether or not any orders matched, so the endpoint can't be used to probe
 * which emails have bought (same guards as lookupOrder: rate limit + Turnstile).
 */
export async function recoverOrders(
  _prev: RecoverResult | null,
  formData: FormData,
): Promise<RecoverResult> {
  const email = String(formData.get('email') ?? '').trim();
  const localeRaw = String(formData.get('locale') ?? 'en');
  const locale = localeRaw === 'th' ? 'th' : 'en';
  if (!email) return { sent: true };

  const ip = await clientIp();
  const token = String(formData.get('turnstileToken') ?? '');
  const rl = await enforceRateLimit('order-recover-ip', ip, { max: 5, windowMs: 600_000 });
  if (!rl.ok) return { error: 'rateLimited' };
  if (!(await verifyTurnstile(token, ip))) return { error: 'verifyFailed' };

  // Case-insensitive EXACT match: escape LIKE wildcards, no % wrapping.
  const exact = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const supa = createServiceRoleSupabase();
  const { data: orders } = await supa
    .from('orders')
    .select('id, number, customer_email, created_at')
    .ilike('customer_email', exact)
    .order('created_at', { ascending: false })
    .limit(RECOVER_LIMIT);

  if (orders && orders.length > 0) {
    const items = orders.map((o) => ({
      number: o.number,
      placedAt: o.created_at,
      url: `${siteUrl()}/${locale}/order/${o.id}?t=${signOrderToken(o.id, o.customer_email)}`,
    }));
    try {
      await sendEmail({
        to: email.toLowerCase(),
        subject: orderLinksSubject(locale),
        react: OrderLinks({ locale, orders: items }),
      });
    } catch (err) {
      console.error('[recoverOrders] order-links email failed', err);
    }
  }

  return { sent: true };
}
