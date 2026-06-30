import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirectMock, rateLimitMock, clientIpMock, turnstileMock, state } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  rateLimitMock: vi.fn(async () => ({ ok: true })),
  clientIpMock: vi.fn(async () => '1.2.3.4'),
  turnstileMock: vi.fn(async () => true),
  state: { order: null as { id: string; customer_email: string } | null },
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: rateLimitMock, clientIp: clientIpMock }));
vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: turnstileMock }));
vi.mock('@/db/server', () => ({
  createServiceRoleSupabase: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.order }) }) }),
    }),
  }),
}));

import { lookupOrder } from '@/server/actions/track-order';

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

describe('lookupOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key-for-unit-tests';
    state.order = null;
    rateLimitMock.mockResolvedValue({ ok: true });
    turnstileMock.mockResolvedValue(true);
  });

  it('returns generic notFound when the order number does not exist', async () => {
    state.order = null;
    const res = await lookupOrder(null, fd({ number: 'NOPE', email: 'a@b.com', locale: 'en' }));
    expect(res).toEqual({ error: 'notFound' });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('returns the SAME generic notFound when the email mismatches (anti-enumeration)', async () => {
    state.order = { id: 'o1', customer_email: 'owner@example.com' };
    const res = await lookupOrder(
      null,
      fd({ number: 'RB-1', email: 'attacker@example.com', locale: 'en' }),
    );
    expect(res).toEqual({ error: 'notFound' });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects to the token-gated order page on an exact, case-insensitive match', async () => {
    state.order = { id: 'o1', customer_email: 'Buyer@Example.com' };
    await expect(
      lookupOrder(null, fd({ number: 'RB-1', email: 'buyer@example.com', locale: 'th' })),
    ).rejects.toThrow(/^REDIRECT:\/th\/order\/o1\?t=/);
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it('returns rateLimited without touching the database', async () => {
    rateLimitMock.mockResolvedValue({ ok: false });
    state.order = { id: 'o1', customer_email: 'buyer@example.com' };
    const res = await lookupOrder(null, fd({ number: 'RB-1', email: 'buyer@example.com' }));
    expect(res).toEqual({ error: 'rateLimited' });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('rejects when Turnstile verification fails', async () => {
    turnstileMock.mockResolvedValue(false);
    state.order = { id: 'o1', customer_email: 'buyer@example.com' };
    const res = await lookupOrder(null, fd({ number: 'RB-1', email: 'buyer@example.com' }));
    expect(res).toEqual({ error: 'verifyFailed' });
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
