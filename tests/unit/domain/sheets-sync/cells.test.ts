import { describe, expect, it } from 'vitest';
import { columnLetter, gridToRows, rowsToGrid } from '@/domain/sheets-sync/cells';
import { SCHEMAS } from '@/domain/sheets-sync/schema';

describe('columnLetter', () => {
  it('maps 0→A, 25→Z, 26→AA', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
  });
});

describe('gridToRows', () => {
  it('parses a header + data grid into SnapshotRows keyed by column', () => {
    const grid = [
      ['pk', 'version', 'sku', 'price_thb', 'stock_available', 'is_active'],
      ['v1', '3', 'TEE-M', '500', '10', 'TRUE'],
    ];
    const rows = gridToRows(grid, SCHEMAS.variants);
    expect(rows).toEqual([
      {
        pk: 'v1',
        version: 3,
        values: { sku: 'TEE-M', price_thb: '500', stock_available: '10', is_active: 'TRUE' },
      },
    ]);
  });

  it('ignores rows with a blank pk', () => {
    const grid = [
      ['pk', 'version', 'sku', 'price_thb', 'stock_available', 'is_active'],
      ['', '1', '', '', '', ''],
    ];
    expect(gridToRows(grid, SCHEMAS.variants)).toEqual([]);
  });
});

describe('rowsToGrid', () => {
  it('round-trips a snapshot back into a header + data grid', () => {
    const rows = [
      {
        pk: 'v1',
        version: 3,
        values: { sku: 'TEE-M', price_thb: '500', stock_available: '10', is_active: 'TRUE' },
      },
    ];
    const grid = rowsToGrid(rows, SCHEMAS.variants);
    expect(grid[0]).toEqual(['pk', 'version', 'sku', 'price_thb', 'stock_available', 'is_active']);
    expect(grid[1]).toEqual(['v1', '3', 'TEE-M', '500', '10', 'TRUE']);
  });
});
