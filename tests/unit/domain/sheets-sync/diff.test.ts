import { describe, expect, it } from 'vitest';
import { diffSnapshots, RUN_CAP } from '@/domain/sheets-sync/diff';
import { SCHEMAS, type TableSnapshot } from '@/domain/sheets-sync/schema';

const db: TableSnapshot = {
  table: 'variants',
  rows: [
    {
      pk: 'v1',
      version: 2,
      values: { sku: 'TEE-M', price_thb: '500', stock_available: '10', is_active: 'TRUE' },
    },
  ],
};

const sheetRow = (over: Partial<Record<string, string>>, version = 2) => ({
  table: 'variants' as const,
  rows: [
    {
      pk: 'v1',
      version,
      values: { sku: 'TEE-M', price_thb: '500', stock_available: '10', is_active: 'TRUE', ...over },
    },
  ],
});

describe('diffSnapshots', () => {
  it('queues an allow-listed change as an apply with the parsed value and bumped version', () => {
    const r = diffSnapshots(db, sheetRow({ stock_available: '7' }), SCHEMAS.variants);
    expect(r.rejects).toEqual([]);
    expect(r.applies).toEqual([
      { table: 'variants', pk: 'v1', nextVersion: 3, changes: { stock_available: 7 } },
    ]);
  });

  it('rejects a read-only column change', () => {
    const r = diffSnapshots(db, sheetRow({ sku: 'HACKED' }), SCHEMAS.variants);
    expect(r.applies).toEqual([]);
    expect(r.rejects[0]).toMatchObject({ column_name: 'sku', reason: 'read_only' });
  });

  it('rejects a change when the sheet version is stale', () => {
    const r = diffSnapshots(db, sheetRow({ stock_available: '7' }, 1), SCHEMAS.variants);
    expect(r.applies).toEqual([]);
    expect(r.rejects[0]).toMatchObject({ column_name: 'stock_available', reason: 'version_stale' });
  });

  it('rejects a value that fails its parser', () => {
    const r = diffSnapshots(db, sheetRow({ stock_available: '-3' }), SCHEMAS.variants);
    expect(r.applies).toEqual([]);
    expect(r.rejects[0]).toMatchObject({ column_name: 'stock_available', reason: 'validation' });
  });

  it('does not emit applies or rejects for unchanged cells', () => {
    const r = diffSnapshots(db, sheetRow({}), SCHEMAS.variants);
    expect(r.applies).toEqual([]);
    expect(r.rejects).toEqual([]);
  });

  it('caps applies at RUN_CAP and rejects the overflow', () => {
    const many = (n: number): TableSnapshot => ({
      table: 'variants',
      rows: Array.from({ length: n }, (_, i) => ({
        pk: `v${i}`,
        version: 1,
        values: { sku: `S${i}`, price_thb: '0', stock_available: '0', is_active: 'TRUE' },
      })),
    });
    const dbMany = many(RUN_CAP + 5);
    const sheetMany: TableSnapshot = {
      table: 'variants',
      rows: dbMany.rows.map((row) => ({ ...row, values: { ...row.values, stock_available: '1' } })),
    };
    const r = diffSnapshots(dbMany, sheetMany, SCHEMAS.variants);
    expect(r.applies).toHaveLength(RUN_CAP);
    expect(r.rejects.filter((x) => x.reason === 'run_cap')).toHaveLength(5);
  });
});

describe('diffSnapshots change details (preview)', () => {
  it('emits a from/to detail for every applied cell', () => {
    const r = diffSnapshots(db, sheetRow({ stock_available: '7' }), SCHEMAS.variants);
    expect(r.details).toEqual([
      {
        table_name: 'variants',
        row_pk: 'v1',
        column_name: 'stock_available',
        from: '10',
        to: '7',
      },
    ]);
  });

  it('emits no details for rejected or unchanged cells', () => {
    const stale = diffSnapshots(db, sheetRow({ stock_available: '7' }, 1), SCHEMAS.variants);
    expect(stale.details).toEqual([]);
    const same = diffSnapshots(db, sheetRow({}), SCHEMAS.variants);
    expect(same.details).toEqual([]);
  });
});
