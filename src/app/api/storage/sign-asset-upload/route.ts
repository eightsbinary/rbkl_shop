import { type NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, requireOwnerOrDev } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

export async function POST(request: NextRequest) {
  try {
    const supa = await createServerSupabase();
    await requireOwnerOrDev(supa);
    const { path } = await request.json();
    if (typeof path !== 'string' || !path.startsWith('qr/')) {
      return NextResponse.json({ error: 'Bad path' }, { status: 400 });
    }
    const { data, error } = await supa.storage.from('payment-assets').createSignedUploadUrl(path);
    if (error || !data)
      return NextResponse.json({ error: error?.message ?? 'Sign failed' }, { status: 500 });
    return NextResponse.json({ token: data.token, path: data.path });
  } catch (e) {
    if (e instanceof ForbiddenError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }
}
