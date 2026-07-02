export type SyncTable = 'products' | 'variants' | 'orders';

/** One reconciled row: primary key, optimistic-concurrency version, and a flat
 *  map of column-key → serialized string value (matching the sheet grid). */
export interface SnapshotRow {
  pk: string;
  version: number;
  values: Record<string, string>;
}

export interface TableSnapshot {
  table: SyncTable;
  rows: SnapshotRow[];
}

export type ParseResult = { ok: true; value: unknown } | { ok: false; reason: string };

export interface ColumnDef {
  /** Logical key, also the sheet header. Dotted for nested jsonb (e.g. 'name.th'). */
  key: string;
  /** In the writeback-allowlist? If false, sheet edits to this column are rejected. */
  writable: boolean;
  /** Parse + validate a raw sheet string into the DB value. Required when writable. */
  parse?: (raw: string) => ParseResult;
}

export interface TableSchema {
  table: SyncTable;
  tab: string;
  columns: ColumnDef[];
}

const text = (raw: string): ParseResult => ({ ok: true, value: raw });

const intNonNeg = (raw: string): ParseResult => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0)
    return { ok: false, reason: 'expected a non-negative integer' };
  return { ok: true, value: n };
};

const nullableInt = (raw: string): ParseResult => {
  if (raw.trim() === '') return { ok: true, value: null };
  return intNonNeg(raw);
};

const bool = (raw: string): ParseResult => {
  const v = raw.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(v)) return { ok: true, value: true };
  if (['false', '0', 'no'].includes(v)) return { ok: true, value: false };
  return { ok: false, reason: 'expected TRUE or FALSE' };
};

const enumParse =
  (values: readonly string[]) =>
  (raw: string): ParseResult =>
    values.includes(raw)
      ? { ok: true, value: raw }
      : { ok: false, reason: `expected one of ${values.join(', ')}` };

export const PRODUCT_STATUS = ['draft', 'active', 'archived'] as const;
export const SHIP_STATUS = ['pending', 'preparing', 'shipped', 'delivered'] as const;

export const SCHEMAS: Record<SyncTable, TableSchema> = {
  products: {
    table: 'products',
    tab: 'products',
    columns: [
      { key: 'slug', writable: false },
      { key: 'name.th', writable: true, parse: text },
      { key: 'name.en', writable: true, parse: text },
      { key: 'description.th', writable: true, parse: text },
      { key: 'description.en', writable: true, parse: text },
      { key: 'base_price_thb', writable: true, parse: intNonNeg },
      { key: 'status', writable: true, parse: enumParse(PRODUCT_STATUS) },
    ],
  },
  variants: {
    table: 'variants',
    tab: 'variants',
    columns: [
      { key: 'sku', writable: false },
      { key: 'price_thb', writable: true, parse: nullableInt },
      { key: 'stock_available', writable: true, parse: intNonNeg },
      { key: 'is_active', writable: true, parse: bool },
    ],
  },
  orders: {
    table: 'orders',
    tab: 'orders',
    columns: [
      { key: 'number', writable: false },
      { key: 'customer_email', writable: false },
      { key: 'ship_status', writable: true, parse: enumParse(SHIP_STATUS) },
      { key: 'tracking_carrier', writable: true, parse: text },
      { key: 'tracking_number', writable: true, parse: text },
      { key: 'notes_to_buyer', writable: true, parse: text },
    ],
  },
};
