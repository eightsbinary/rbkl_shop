import { NextResponse } from 'next/server';
import * as z from 'zod';
import { createServerSupabase } from '@/db/server';
import { clientIp, enforceRateLimit } from '@/lib/rate-limit';

const Body = z.object({
  email: z.string().email(),
  locale: z.enum(['th', 'en']),
  source: z.string().max(50).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { email, locale, source } = parsed.data;

  const ip = await clientIp();
  const rl = await enforceRateLimit('newsletter', ip, { max: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

  const supa = await createServerSupabase();
  const { error } = await supa.from('newsletter_subscribers').insert({
    email: email.toLowerCase(),
    locale,
    source: source ?? 'home_band',
  });

  // 23505 = unique violation → already subscribed, which is success from the fan's view.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not subscribe' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
