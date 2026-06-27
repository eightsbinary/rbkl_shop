import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const apply = vi.fn(async (..._args: unknown[]) => {});
const read = vi.fn();
vi.mock('@/server/queries/sheet-snapshot', () => ({
  SYNC_TABLES: ['variants'],
  readSnapshot: (...a: unknown[]) => read(...a),
  applyOps: (...a: unknown[]) => apply(...a),
}));

const getValues = vi.fn();
const updateValues = vi.fn(async () => {});
vi.mock('@/lib/sheets/client', () => ({
  sheetsClientFromEnv: () => ({ getValues, updateValues }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runSheetSyncCycle (pure cycle)', () => {
  it('applies an allow-listed sheet edit and reports counts', async () => {
    const { runSheetSyncCycle } = await import('@/server/sheets/cycle');
    read.mockResolvedValue({
      table: 'variants',
      rows: [
        {
          pk: 'v1',
          version: 2,
          values: { sku: 'TEE', price_thb: '500', stock_available: '10', is_active: 'TRUE' },
        },
      ],
    });
    getValues.mockResolvedValue([
      ['pk', 'version', 'sku', 'price_thb', 'stock_available', 'is_active'],
      ['v1', '2', 'TEE', '500', '7', 'TRUE'],
    ]);

    const result = await runSheetSyncCycle({ getValues, updateValues } as never);

    expect(apply).toHaveBeenCalledWith('variants', [
      { table: 'variants', pk: 'v1', nextVersion: 3, changes: { stock_available: 7 } },
    ]);
    expect(updateValues).toHaveBeenCalled(); // pushed fresh snapshot back
    expect(result.applied).toBe(1);
    expect(result.rejected).toBe(0);
  });
});
