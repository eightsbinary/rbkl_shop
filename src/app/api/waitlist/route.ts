import { NextResponse } from 'next/server';
import * as z from 'zod';
import { createServerSupabase } from '@/db/server';

const Body = z.object({
  variantId: z.string().uuid(),
  email: z.string().email(),
  locale: z.enum(['th', 'en']),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { variantId, email, locale } = parsed.data;

  const supa = await createServerSupabase();
  const { error } = await supa.from('waitlist_entries').insert({
    variant_id: variantId,
    email: email.toLowerCase(),
    locale,
  });

  // 23505 = unique violation → already on the list, which is success from the fan's view.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: 'Could not join the waitlist' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
