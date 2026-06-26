import { type NextRequest, NextResponse } from 'next/server';
import { previewCart } from '@/server/queries/cart';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.ids)) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  const ids = (body.ids as unknown[]).filter((x): x is string => typeof x === 'string');
  const lines = await previewCart(ids);
  return NextResponse.json(lines);
}
