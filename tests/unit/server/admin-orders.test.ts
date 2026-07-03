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
    eq: (...args: unknown[]) => track('eq', args),
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

import { listAdminOrders, orderSearchPattern } from '@/server/queries/admin-orders';

describe('orderSearchPattern', () => {
  it('wraps the term in wildcards for a partial match', () => {
    expect(orderSearchPattern('RB-1042')).toBe('%RB-1042%');
  });

  it('escapes ilike wildcards so user input matches literally', () => {
    expect(orderSearchPattern('50%_off')).toBe('%50\\%\\_off%');
  });

  it('strips PostgREST or() metacharacters', () => {
    expect(orderSearchPattern('a,b(c)"d\\e')).toBe('%abcde%');
  });

  it('returns null for blank or whitespace-only input', () => {
    expect(orderSearchPattern('')).toBeNull();
    expect(orderSearchPattern('   ')).toBeNull();
  });

  it('returns null when stripping leaves nothing', () => {
    expect(orderSearchPattern('(),"')).toBeNull();
  });
});

describe('listAdminOrders search', () => {
  beforeEach(() => {
    state.calls = [];
    state.rows = [];
  });

  it('filters on number OR customer_email with the sanitized pattern', async () => {
    await listAdminOrders(undefined, undefined, 'kello');
    const or = state.calls.find((c) => c.method === 'or');
    expect(or?.args[0]).toBe('number.ilike.%kello%,customer_email.ilike.%kello%');
  });

  it('does not add an or() filter when the term is blank', async () => {
    await listAdminOrders(undefined, undefined, '   ');
    expect(state.calls.some((c) => c.method === 'or')).toBe(false);
  });

  it('composes search with the status filter', async () => {
    await listAdminOrders('paid', undefined, 'RB-1');
    const eq = state.calls.find((c) => c.method === 'eq');
    expect(eq?.args).toEqual(['status', 'paid']);
    const or = state.calls.find((c) => c.method === 'or');
    expect(or?.args[0]).toBe('number.ilike.%RB-1%,customer_email.ilike.%RB-1%');
  });
});
