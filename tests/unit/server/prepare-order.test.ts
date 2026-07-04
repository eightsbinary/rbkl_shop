import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { state, sendEmailMock, stepUpMock } = vi.hoisted(() => ({
  state: {
    calls: [] as { method: string; args: unknown[] }[],
    updated: null as { id: string; customer_email: string; locale: string; number: string } | null,
  },
  sendEmailMock: vi.fn(async () => ({ ok: true, dryRun: false })),
  stepUpMock: vi.fn(async (): Promise<{ error: string } | null> => null),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/db/auth', () => ({
  requireOwnerOrDev: vi.fn(async () => ({})),
  stepUpGuard: stepUpMock,
}));
vi.mock('@/lib/email', () => ({ sendEmail: sendEmailMock }));
vi.mock('@/db/server', () => {
  const builder = {
    update: (...args: unknown[]) => track('update', args),
    insert: (...args: unknown[]) => track('insert', args),
    eq: (...args: unknown[]) => track('eq', args),
    select: (...args: unknown[]) => track('select', args),
    maybeSingle: async () => ({ data: state.updated }),
    // biome-ignore lint/suspicious/noThenProperty: awaited insert chain needs a thenable
    then: (resolve: (v: { data: unknown; error: null }) => void) =>
      resolve({ data: null, error: null }),
  };
  function track(method: string, args: unknown[]) {
    state.calls.push({ method, args });
    return builder;
  }
  return {
    createServerSupabase: async () => ({ from: () => builder }),
    createServiceRoleSupabase: () => ({ from: () => builder }),
  };
});

import { startPreparing } from '@/server/actions/prepare-order';

describe('startPreparing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key-for-unit-tests';
    state.calls = [];
    state.updated = {
      id: 'o1',
      customer_email: 'buyer@example.com',
      locale: 'th',
      number: 'RVWCRZ9ASWCG',
    };
  });

  it('moves the order to preparing only from awaiting_stock and emails the buyer', async () => {
    const res = await startPreparing('o1');
    expect(res).toEqual({ ok: true });
    const update = state.calls.find((c) => c.method === 'update');
    expect(update?.args[0]).toMatchObject({ ship_status: 'preparing' });
    // transition guard: the update is scoped to ship_status = awaiting_stock
    const eqs = state.calls.filter((c) => c.method === 'eq').map((c) => c.args);
    expect(eqs).toContainEqual(['ship_status', 'awaiting_stock']);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'buyer@example.com' }),
    );
  });

  it('returns an error and sends nothing when the order is not awaiting stock', async () => {
    state.updated = null;
    const res = await startPreparing('o1');
    expect(res).toHaveProperty('error');
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('stops at the step-up gate without updating', async () => {
    stepUpMock.mockResolvedValueOnce({ error: 'step-up-required' });
    const res = await startPreparing('o1');
    expect(res).toEqual({ error: 'step-up-required' });
    expect(state.calls.some((c) => c.method === 'update')).toBe(false);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
