import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { state, sendEmailMock, rateLimitMock, clientIpMock, turnstileMock } = vi.hoisted(() => ({
  state: {
    calls: [] as { method: string; args: unknown[] }[],
    rows: [] as { id: string; number: string; customer_email: string; created_at: string }[],
  },
  sendEmailMock: vi.fn(async () => ({ ok: true, dryRun: false })),
  rateLimitMock: vi.fn(async () => ({ ok: true })),
  clientIpMock: vi.fn(async () => '1.2.3.4'),
  turnstileMock: vi.fn(async () => true),
}));

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: rateLimitMock, clientIp: clientIpMock }));
vi.mock('@/lib/turnstile', () => ({ verifyTurnstile: turnstileMock }));
vi.mock('@/lib/email', () => ({ sendEmail: sendEmailMock }));
vi.mock('@/db/server', () => {
  const builder = {
    select: (...args: unknown[]) => track('select', args),
    ilike: (...args: unknown[]) => track('ilike', args),
    order: (...args: unknown[]) => track('order', args),
    limit: (...args: unknown[]) => track('limit', args),
    // biome-ignore lint/suspicious/noThenProperty: the supabase query builder is awaited directly, so the mock must be thenable
    then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: state.rows }),
  };
  function track(method: string, args: unknown[]) {
    state.calls.push({ method, args });
    return builder;
  }
  return { createServiceRoleSupabase: () => ({ from: () => builder }) };
});

import { recoverOrders } from '@/server/actions/track-order';

function fd(obj: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
}

describe('recoverOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key-for-unit-tests';
    state.calls = [];
    state.rows = [];
    rateLimitMock.mockResolvedValue({ ok: true });
    turnstileMock.mockResolvedValue(true);
  });

  it('emails the buyer their order links when orders exist', async () => {
    state.rows = [
      {
        id: 'o1',
        number: 'RVWCRZ9ASWCG',
        customer_email: 'Buyer@Example.com',
        created_at: '2026-07-01T00:00:00Z',
      },
    ];
    const res = await recoverOrders(null, fd({ email: 'buyer@example.com', locale: 'th' }));
    expect(res).toEqual({ sent: true });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'buyer@example.com' }),
    );
    // exact-match lookup: ilike with wildcards escaped, no % wrapping
    const ilike = state.calls.find((c) => c.method === 'ilike');
    expect(ilike?.args).toEqual(['customer_email', 'buyer@example.com']);
  });

  it('returns the SAME generic result and sends nothing when no orders match (anti-enumeration)', async () => {
    state.rows = [];
    const res = await recoverOrders(null, fd({ email: 'stranger@example.com', locale: 'en' }));
    expect(res).toEqual({ sent: true });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('escapes ilike wildcards in the email so lookup stays exact', async () => {
    await recoverOrders(null, fd({ email: 'a_b%c@example.com', locale: 'en' }));
    const ilike = state.calls.find((c) => c.method === 'ilike');
    expect(ilike?.args).toEqual(['customer_email', 'a\\_b\\%c@example.com']);
  });

  it('rate-limits without touching the database', async () => {
    rateLimitMock.mockResolvedValue({ ok: false });
    const res = await recoverOrders(null, fd({ email: 'buyer@example.com', locale: 'en' }));
    expect(res).toEqual({ error: 'rateLimited' });
    expect(state.calls.length).toBe(0);
  });

  it('rejects when Turnstile verification fails', async () => {
    turnstileMock.mockResolvedValue(false);
    const res = await recoverOrders(null, fd({ email: 'buyer@example.com', locale: 'en' }));
    expect(res).toEqual({ error: 'verifyFailed' });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
