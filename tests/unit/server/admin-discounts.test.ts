import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { state } = vi.hoisted(() => ({
  state: { calls: [] as { method: string; args: unknown[] }[], rows: [] as unknown[] },
}));

vi.mock('@/db/server', () => {
  const builder = {
    select: (...args: unknown[]) => track('select', args),
    order: (...args: unknown[]) => track('order', args),
    ilike: (...args: unknown[]) => track('ilike', args),
    // biome-ignore lint/suspicious/noThenProperty: the supabase query builder is awaited directly, so the mock must be thenable
    then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: state.rows }),
  };
  function track(method: string, args: unknown[]) {
    state.calls.push({ method, args });
    return builder;
  }
  return { createServerSupabase: async () => ({ from: () => builder }) };
});

import { listAdminDiscounts } from '@/server/queries/admin-discounts';

describe('listAdminDiscounts search', () => {
  beforeEach(() => {
    state.calls = [];
    state.rows = [];
  });

  it('filters on code with the sanitized pattern', async () => {
    await listAdminDiscounts('SUMMER');
    const ilike = state.calls.find((c) => c.method === 'ilike');
    expect(ilike?.args).toEqual(['code', '%SUMMER%']);
  });

  it('does not filter when the term is blank', async () => {
    await listAdminDiscounts('   ');
    expect(state.calls.some((c) => c.method === 'ilike')).toBe(false);
  });
});
