import { type NextRequest, NextResponse } from 'next/server';
import { ForbiddenError, requireOwnerOrDev } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

// Each admin-uploadable prefix maps to its bucket. Filenames are a single flat
// segment (\w.- only, no further slashes), so a path can't escape its prefix.
const PREFIX_BUCKETS = [
  { pattern: /^qr\/[\w-]+(\.[\w-]+)*$/, bucket: 'payment-assets' },
  { pattern: /^about\/[\w-]+(\.[\w-]+)*$/, bucket: 'about-assets' },
] as const;

export async function POST(request: NextRequest) {
  try {
    const supa = await createServerSupabase();
    await requireOwnerOrDev(supa);
    const { path } = await request.json();
    const bucket =
      typeof path === 'string'
        ? PREFIX_BUCKETS.find(({ pattern }) => pattern.test(path))?.bucket
        : undefined;
    if (!bucket) {
      return NextResponse.json({ error: 'Bad path' }, { status: 400 });
    }
    const { data, error } = await supa.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data)
      return NextResponse.json({ error: error?.message ?? 'Sign failed' }, { status: 500 });
    return NextResponse.json({ token: data.token, path: data.path });
  } catch (e) {
    if (e instanceof ForbiddenError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    throw e;
  }
}
