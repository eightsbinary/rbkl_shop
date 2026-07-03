import { beforeEach, describe, expect, it, vi } from 'vitest';

// `server-only` throws when imported outside an RSC graph; stub it for the test.
vi.mock('server-only', () => ({}));

const { state } = vi.hoisted(() => ({
  state: {
    calls: [] as { method: string; args: unknown[] }[],
    rows: [] as unknown[],
  },
}));

vi.mock('@/db/server', () => {
  const builder = {
    select: (...args: unknown[]) => track('select', args),
    order: (...args: unknown[]) => track('order', args),
    or: (...args: unknown[]) => track('or', args),
    // biome-ignore lint/suspicious/noThenProperty: the supabase query builder is awaited directly, so the mock must be thenable
    then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: state.rows }),
  };
  function track(method: string, args: unknown[]) {
    state.calls.push({ method, args });
    return builder;
  }
  return { createServerSupabase: async () => ({ from: () => builder }) };
});

import { listAdminProducts } from '@/server/queries/admin-products';

describe('listAdminProducts search', () => {
  beforeEach(() => {
    state.calls = [];
    state.rows = [];
  });

  it('filters on slug OR localized names with the sanitized pattern', async () => {
    await listAdminProducts('hoodie');
    const or = state.calls.find((c) => c.method === 'or');
    expect(or?.args[0]).toBe(
      'slug.ilike.%hoodie%,name->>en.ilike.%hoodie%,name->>th.ilike.%hoodie%',
    );
  });

  it('does not add an or() filter when the term is blank', async () => {
    await listAdminProducts('   ');
    expect(state.calls.some((c) => c.method === 'or')).toBe(false);
  });

  it('returns the queried rows', async () => {
    state.rows = [{ id: 'p1' }];
    const rows = await listAdminProducts();
    expect(rows).toEqual([{ id: 'p1' }]);
  });
});
