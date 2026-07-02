import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '@/db/auth';

const { requireMock, signCalls } = vi.hoisted(() => ({
  requireMock: vi.fn(async () => {}),
  signCalls: [] as Array<{ bucket: string; path: string }>,
}));

vi.mock('@/db/auth', async (orig) => {
  const actual = await orig<typeof import('@/db/auth')>();
  return { ...actual, requireOwnerOrDev: requireMock };
});
vi.mock('@/db/server', () => ({
  createServerSupabase: async () => ({
    storage: {
      from: (bucket: string) => ({
        createSignedUploadUrl: async (path: string) => {
          signCalls.push({ bucket, path });
          return { data: { token: 'tok', path }, error: null };
        },
      }),
    },
  }),
}));

import { POST } from '@/app/api/storage/sign-asset-upload/route';

function req(path: unknown) {
  return new NextRequest('http://localhost/api/storage/sign-asset-upload', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

describe('POST /api/storage/sign-asset-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMock.mockResolvedValue(undefined);
    signCalls.length = 0;
  });

  it('returns 403 for a non-owner', async () => {
    requireMock.mockRejectedValue(new ForbiddenError());
    expect((await POST(req('qr/x.png'))).status).toBe(403);
  });

  it('signs qr/ paths against payment-assets', async () => {
    const res = await POST(req('qr/1.png'));
    expect(res.status).toBe(200);
    expect(signCalls).toEqual([{ bucket: 'payment-assets', path: 'qr/1.png' }]);
  });

  it('signs about/ paths against about-assets', async () => {
    const res = await POST(req('about/hero-2.png'));
    expect(res.status).toBe(200);
    expect(signCalls).toEqual([{ bucket: 'about-assets', path: 'about/hero-2.png' }]);
  });

  it('rejects paths outside the known prefixes', async () => {
    expect((await POST(req('products/x.png'))).status).toBe(400);
    expect((await POST(req('about/../qr/x.png'))).status).toBe(400);
    expect((await POST(req(42))).status).toBe(400);
    expect(signCalls).toHaveLength(0);
  });
});
