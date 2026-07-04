import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { state } = vi.hoisted(() => ({
  state: { rows: [] as unknown[] },
}));

vi.mock('@/db/server', () => {
  const builder = {
    select: () => builder,
    is: () => builder,
    order: () => builder,
    // biome-ignore lint/suspicious/noThenProperty: the supabase query builder is awaited directly, so the mock must be thenable
    then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: state.rows }),
  };
  return { createServerSupabase: async () => ({ from: () => builder }) };
});

import { listWaitlistGroups } from '@/server/queries/admin-waitlists';

const entry = (variantId: string, name: string, slug: string, size = 'M') => ({
  variant_id: variantId,
  created_at: '2026-07-01T00:00:00Z',
  variants: {
    stock_available: 0,
    option_values: { size },
    products: { name: { en: name, th: name }, slug },
  },
});

describe('listWaitlistGroups search', () => {
  beforeEach(() => {
    state.rows = [
      entry('v1', 'Aura Tote Bag', 'aura-tote'),
      entry('v2', 'Nano Tee', 'nano-tee', 'L'),
    ];
  });

  it('returns all groups without a search term', async () => {
    const groups = await listWaitlistGroups();
    expect(groups).toHaveLength(2);
  });

  it('filters groups by product name, case-insensitively', async () => {
    const groups = await listWaitlistGroups('tote');
    expect(groups.map((g) => g.slug)).toEqual(['aura-tote']);
  });

  it('matches on option label too', async () => {
    const groups = await listWaitlistGroups('L');
    expect(groups.map((g) => g.slug)).toEqual(['nano-tee']);
  });

  it('returns nothing when no group matches', async () => {
    const groups = await listWaitlistGroups('zzz');
    expect(groups).toHaveLength(0);
  });
});
