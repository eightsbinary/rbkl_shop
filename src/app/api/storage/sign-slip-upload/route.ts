import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { verifyOrderToken } from '@/lib/order-token';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function POST(request: NextRequest) {
  const ip = await clientIp();
  const rl = await enforceRateLimit('slip-upload', ip, { max: 10, windowMs: 600_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });

  const { orderId, token, contentType, ext } = (await request.json()) as {
    orderId?: string;
    token?: string;
    contentType?: string;
    ext?: string;
  };
  if (!orderId || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!contentType || !ALLOWED.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
  }

  const supa = createServiceRoleSupabase();
  const { data: order } = await supa
    .from('orders')
    .select('id, status, customer_email')
    .eq('id', orderId)
    .maybeSingle();
  // Token is HMAC-bound to (orderId, email) — verify against the order's email.
  if (!order || !verifyOrderToken(token, orderId, order.customer_email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (order.status !== 'awaiting_payment' && order.status !== 'awaiting_verification') {
    return NextResponse.json({ error: 'Order not awaiting payment' }, { status: 409 });
  }

  const safeExt = /^(png|jpg|jpeg|webp)$/.test(ext ?? '') ? ext : 'png';
  const path = `${orderId}/${Date.now()}.${safeExt}`;
  const { data, error } = await supa.storage.from('payment-slips').createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Sign failed' }, { status: 500 });
  }
  return NextResponse.json({ token: data.token, path: data.path });
}
