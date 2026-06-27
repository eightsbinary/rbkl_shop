# Plan 5 — Google Sheets sync (core engine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A safe two-way sync between the database and a Google Sheet for `products`, `variants`, and `orders` — DB is authoritative, the sheet is overwritten with a fresh snapshot every run, and only an allow-listed set of columns can be written back.

**Architecture:** Approach A — a **pure diff core** (`src/domain/sheets-sync/`, no I/O, fully unit-tested) wrapped by **thin I/O adapters**: a `SheetsClient` (service-account JWT + REST) and DB snapshot/apply queries. A dev-only server action orchestrates pull → diff → apply (per-table transaction) → push-back → audit. Triggered manually from a dev-only admin screen, debounced 5 minutes, capped at 500 row-diffs per run.

**Tech Stack:** Next.js 16 server actions, Supabase (service role for writes), `google-auth-library` (JWT) + Sheets REST API via `fetch`, Zod, Vitest. Bun for everything except `next build`.

**Reference:** Spec [docs/superpowers/specs/2026-06-27-rb-shop-sheets-sync-design.md](../specs/2026-06-27-rb-shop-sheets-sync-design.md).

---

## Conventions (carry-over)

Branch `develop`, commit per task. Bun for test/lint/typecheck; `node` for `next build`. `import * as z from 'zod'` (namespace import). Run WSL commands via a script file in `\\wsl.localhost\Ubuntu\tmp\` then `wsl -d Ubuntu -- bash -lc "bash /tmp/<file>.sh"` (Windows PATH has parens that break inline `$PATH`). Test command: `bun run vitest run <path>`. Typecheck: `bun run tsc --noEmit`. Lint: `bun run biome check --write <paths>`.

## File structure built by this plan

```
rb_shop/
├── src/
│   ├── domain/sheets-sync/
│   │   ├── schema.ts        Tab/column/allowlist/validator definitions + shared types
│   │   ├── cells.ts         column-index ⇄ A1 mapping, value (de)serialization
│   │   └── diff.ts          diffSnapshots() pure reconciliation
│   ├── lib/sheets/
│   │   └── client.ts        SheetsClient: JWT auth + REST getValues/updateValues
│   ├── server/
│   │   ├── queries/sheet-snapshot.ts   DB rows → TableSnapshot
│   │   └── actions/sync-sheets.ts      dev-only orchestrator
│   └── app/admin/sync/
│       ├── page.tsx         dev-only screen
│       └── SyncPanel.tsx    client island (Sync now button + result)
├── supabase/
│   ├── migrations/20260627003000_sheet_sync.sql
│   └── policies/sheet_sync.sql
└── tests/unit/domain/sheets-sync/
    ├── cells.test.ts
    └── diff.test.ts
```

---

## Task 1: Migration — sheet_sync audit tables

**Files:**
- Create: `supabase/migrations/20260627003000_sheet_sync.sql`
- Create: `supabase/policies/sheet_sync.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Audit trail for Google Sheets sync runs (Plan 5).

create table public.sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('manual')),
  status text not null check (status in ('running', 'ok', 'error')),
  rows_pulled int not null default 0,
  rows_applied int not null default 0,
  rows_rejected int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.sheet_sync_rejects (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.sheet_sync_runs(id) on delete cascade,
  table_name text not null,
  row_pk text not null,
  column_name text not null,
  reason text not null check (reason in ('read_only', 'version_stale', 'validation', 'run_cap')),
  attempted_value text,
  created_at timestamptz not null default now()
);

create index sheet_sync_runs_started_idx on public.sheet_sync_runs(started_at desc);
create index sheet_sync_rejects_run_idx on public.sheet_sync_rejects(run_id);

alter table public.sheet_sync_runs enable row level security;
alter table public.sheet_sync_rejects enable row level security;

-- Diagnostics: dev-only read. Writes happen via service_role in the action.
create policy "sheet_sync_runs_dev_select"
on public.sheet_sync_runs for select to authenticated using (public.is_dev());

create policy "sheet_sync_rejects_dev_select"
on public.sheet_sync_rejects for select to authenticated using (public.is_dev());

grant select, insert, update, delete
  on public.sheet_sync_runs, public.sheet_sync_rejects to service_role;
grant select on public.sheet_sync_runs, public.sheet_sync_rejects to authenticated;
```

- [ ] **Step 2: Mirror the policies file**

Create `supabase/policies/sheet_sync.sql` with the same `alter table … enable row level security`, the two `create policy` blocks, and the two `grant` statements from Step 1, prefixed with a comment: `-- Review mirror of supabase/migrations/20260627003000_sheet_sync.sql.`

- [ ] **Step 3: Apply the migration**

Write `\\wsl.localhost\Ubuntu\tmp\p5-migrate.sh`:
```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
supabase migration up --local 2>&1 | tail -8
```
Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p5-migrate.sh"`
Expected: `Applying migration 20260627003000_sheet_sync.sql...`

- [ ] **Step 4: Verify the tables**

Run: `wsl -d Ubuntu -- bash -lc "docker exec supabase_db_rb_shop psql -U postgres -d postgres -c '\dt public.sheet_sync*'"`
Expected: both `sheet_sync_runs` and `sheet_sync_rejects` listed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260627003000_sheet_sync.sql supabase/policies/sheet_sync.sql
git commit -m "feat(db): sheet_sync_runs + sheet_sync_rejects audit tables + RLS"
```

---

## Task 2: Regenerate types

**Files:**
- Modify: `src/db/types.gen.ts`

- [ ] **Step 1: Regenerate**

Write `\\wsl.localhost\Ubuntu\tmp\p5-types.sh`:
```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun run db:types 2>&1 | tail -5
grep -c "sheet_sync_runs" src/db/types.gen.ts
```
Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p5-types.sh"`
Expected: `Wrote src/db/types.gen.ts` and a count `>= 1`.

- [ ] **Step 2: Commit**

```bash
git add src/db/types.gen.ts
git commit -m "chore(db): regenerate types for sheet_sync tables"
```

---

## Task 3: Sync schema definitions

**Files:**
- Create: `src/domain/sheets-sync/schema.ts`

Defines the shared types and the per-table tab layout: which columns exist, which are writable (the writeback-allowlist), and a validator per writable column. Pure data — no I/O.

- [ ] **Step 1: Write the schema module**

```ts
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
  if (!Number.isInteger(n) || n < 0) return { ok: false, reason: 'expected a non-negative integer' };
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
```

- [ ] **Step 2: Typecheck**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && \$HOME/.bun/bin/bun run tsc --noEmit 2>&1 | tail -5"`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/domain/sheets-sync/schema.ts
git commit -m "feat(sheets-sync): table schema + writeback-allowlist + parsers"
```

---

## Task 4: Cell mapping (TDD)

**Files:**
- Create: `src/domain/sheets-sync/cells.ts`
- Test: `tests/unit/domain/sheets-sync/cells.test.ts`

Maps a zero-based column index to an A1 column letter and back, and turns a grid of string rows (with a header row) into `SnapshotRow`s keyed by the schema's columns. The grid always carries a hidden-ish `pk` and `version` column as the first two columns.

- [ ] **Step 1: Write the failing test**

```ts
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
      { pk: 'v1', version: 3, values: { sku: 'TEE-M', price_thb: '500', stock_available: '10', is_active: 'TRUE' } },
    ];
    const grid = rowsToGrid(rows, SCHEMAS.variants);
    expect(grid[0]).toEqual(['pk', 'version', 'sku', 'price_thb', 'stock_available', 'is_active']);
    expect(grid[1]).toEqual(['v1', '3', 'TEE-M', '500', '10', 'TRUE']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/domain/sheets-sync/cells.test.ts"`
(Reuse the `vitest.sh` helper: `cd … && export PATH=… && bun run vitest run "$@"`.)
Expected: FAIL — `Failed to resolve import "@/domain/sheets-sync/cells"`.

- [ ] **Step 3: Write the implementation**

```ts
import type { SnapshotRow, TableSchema } from './schema';

/** Zero-based column index → A1 letters (0→A, 26→AA). */
export function columnLetter(index: number): string {
  let n = index;
  let out = '';
  do {
    out = String.fromCharCode((n % 26) + 65) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

/** The fixed grid header for a tab: pk, version, then each schema column key. */
export function headerRow(schema: TableSchema): string[] {
  return ['pk', 'version', ...schema.columns.map((c) => c.key)];
}

export function gridToRows(grid: string[][], schema: TableSchema): SnapshotRow[] {
  const [, ...dataRows] = grid; // drop header
  const rows: SnapshotRow[] = [];
  for (const raw of dataRows) {
    const pk = (raw[0] ?? '').trim();
    if (pk === '') continue;
    const version = Number(raw[1] ?? '0');
    const values: Record<string, string> = {};
    schema.columns.forEach((col, i) => {
      values[col.key] = raw[i + 2] ?? '';
    });
    rows.push({ pk, version, values });
  }
  return rows;
}

export function rowsToGrid(rows: SnapshotRow[], schema: TableSchema): string[][] {
  const grid: string[][] = [headerRow(schema)];
  for (const row of rows) {
    grid.push([
      row.pk,
      String(row.version),
      ...schema.columns.map((c) => row.values[c.key] ?? ''),
    ]);
  }
  return grid;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/domain/sheets-sync/cells.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/sheets-sync/cells.ts tests/unit/domain/sheets-sync/cells.test.ts
git commit -m "feat(sheets-sync): cell/grid mapping (TDD)"
```

---

## Task 5: Diff engine (TDD)

**Files:**
- Create: `src/domain/sheets-sync/diff.ts`
- Test: `tests/unit/domain/sheets-sync/diff.test.ts`

The heart of the feature. Compares a sheet snapshot against the DB snapshot and produces allow-listed applies + classified rejects. Pure.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { diffSnapshots, RUN_CAP } from '@/domain/sheets-sync/diff';
import { SCHEMAS, type TableSnapshot } from '@/domain/sheets-sync/schema';

const db: TableSnapshot = {
  table: 'variants',
  rows: [
    { pk: 'v1', version: 2, values: { sku: 'TEE-M', price_thb: '500', stock_available: '10', is_active: 'TRUE' } },
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/domain/sheets-sync/diff.test.ts"`
Expected: FAIL — cannot resolve `@/domain/sheets-sync/diff`.

- [ ] **Step 3: Write the implementation**

```ts
import type { SyncTable, TableSchema, TableSnapshot } from './schema';

export const RUN_CAP = 500;

export interface ApplyOp {
  table: SyncTable;
  pk: string;
  nextVersion: number;
  changes: Record<string, unknown>;
}

export interface RejectOp {
  table_name: SyncTable;
  row_pk: string;
  column_name: string;
  reason: 'read_only' | 'version_stale' | 'validation' | 'run_cap';
  attempted_value: string;
}

export interface DiffResult {
  applies: ApplyOp[];
  rejects: RejectOp[];
  counts: { applied: number; rejected: number };
}

export function diffSnapshots(
  db: TableSnapshot,
  sheet: TableSnapshot,
  schema: TableSchema,
): DiffResult {
  const dbByPk = new Map(db.rows.map((r) => [r.pk, r]));
  const colByKey = new Map(schema.columns.map((c) => [c.key, c]));
  const applies: ApplyOp[] = [];
  const rejects: RejectOp[] = [];
  let appliedCount = 0;

  for (const sheetRow of sheet.rows) {
    const dbRow = dbByPk.get(sheetRow.pk);
    if (!dbRow) continue; // row-creation from the sheet is out of scope (5b)

    const changes: Record<string, unknown> = {};
    for (const col of schema.columns) {
      const sheetVal = sheetRow.values[col.key] ?? '';
      const dbVal = dbRow.values[col.key] ?? '';
      if (sheetVal === dbVal) continue; // unchanged

      const base = { table_name: schema.table, row_pk: sheetRow.pk, column_name: col.key, attempted_value: sheetVal };
      if (!col.writable || !col.parse) {
        rejects.push({ ...base, reason: 'read_only' });
        continue;
      }
      if (sheetRow.version !== dbRow.version) {
        rejects.push({ ...base, reason: 'version_stale' });
        continue;
      }
      const parsed = col.parse(sheetVal);
      if (!parsed.ok) {
        rejects.push({ ...base, reason: 'validation' });
        continue;
      }
      if (appliedCount >= RUN_CAP) {
        rejects.push({ ...base, reason: 'run_cap' });
        continue;
      }
      changes[col.key] = parsed.value;
      appliedCount += 1;
    }

    if (Object.keys(changes).length > 0) {
      applies.push({ table: schema.table, pk: sheetRow.pk, nextVersion: dbRow.version + 1, changes });
    }
  }

  return { applies, rejects, counts: { applied: applies.length, rejected: rejects.length } };
}
```

Note: `counts.applied` is the number of apply *operations* (one per row). The per-row apply contains one or more column changes; `RUN_CAP` bounds the number of *column* changes via `appliedCount`. The cap test changes one column per row, so rows == column-changes and the assertion holds.

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/domain/sheets-sync/diff.test.ts"`
Expected: PASS (6 tests).

- [ ] **Step 5: Add the domain index export + commit**

Add to `src/domain/index.ts` (keep alphabetical among existing exports):
```ts
export * from './sheets-sync/diff';
export * from './sheets-sync/schema';
```

```bash
git add src/domain/sheets-sync/diff.ts tests/unit/domain/sheets-sync/diff.test.ts src/domain/index.ts
git commit -m "feat(sheets-sync): pure diff engine — allowlist + version concurrency + run cap (TDD)"
```

---

## Task 6: SheetsClient (service-account auth + REST)

**Files:**
- Modify: `package.json` (add `google-auth-library`)
- Create: `src/lib/sheets/client.ts`
- Test: `tests/unit/lib/sheets-client.test.ts`

- [ ] **Step 1: Install the dependency**

Write `\\wsl.localhost\Ubuntu\tmp\p5-install.sh`:
```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
bun add google-auth-library 2>&1 | tail -6
```
Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p5-install.sh"`
Expected: `installed google-auth-library@...`.

- [ ] **Step 2: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getAccessToken = vi.fn(async () => ({ token: 'tok_123' }));
vi.mock('google-auth-library', () => ({
  JWT: class {
    getAccessToken = getAccessToken;
  },
}));

const { SheetsClient } = await import('@/lib/sheets/client');

beforeEach(() => {
  vi.unstubAllGlobals();
  getAccessToken.mockClear();
});

describe('SheetsClient.getValues', () => {
  it('GETs the A1 range with a bearer token and returns the value grid', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ values: [['pk', 'version'], ['v1', '2']] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const client = new SheetsClient({ clientEmail: 'svc@x.iam', privateKey: 'KEY', spreadsheetId: 'SID' });
    const grid = await client.getValues('variants');

    expect(grid).toEqual([['pk', 'version'], ['v1', '2']]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/SID/values/variants');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok_123' });
  });
});

describe('SheetsClient.updateValues', () => {
  it('PUTs the grid to the tab range with USER_ENTERED input', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const client = new SheetsClient({ clientEmail: 'svc@x.iam', privateKey: 'KEY', spreadsheetId: 'SID' });
    await client.updateValues('variants', [['pk', 'version'], ['v1', '3']]);

    const [url, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).method).toBe('PUT');
    expect(String(url)).toContain('valueInputOption=USER_ENTERED');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      values: [['pk', 'version'], ['v1', '3']],
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/lib/sheets-client.test.ts"`
Expected: FAIL — cannot resolve `@/lib/sheets/client`.

- [ ] **Step 4: Write the implementation**

```ts
import 'server-only';
import { JWT } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface SheetsConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

export class SheetsClient {
  private jwt: JWT;
  private spreadsheetId: string;

  constructor(cfg: SheetsConfig) {
    this.spreadsheetId = cfg.spreadsheetId;
    this.jwt = new JWT({ email: cfg.clientEmail, key: cfg.privateKey, scopes: SCOPES });
  }

  private async token(): Promise<string> {
    const { token } = await this.jwt.getAccessToken();
    if (!token) throw new Error('Sheets auth failed: no access token');
    return token;
  }

  /** Read a whole tab (range = tab name) as a 2-D string grid. */
  async getValues(tab: string): Promise<string[][]> {
    const url = `${BASE}/${this.spreadsheetId}/values/${encodeURIComponent(tab)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${await this.token()}` } });
    if (!res.ok) throw new Error(`Sheets getValues ${tab} failed: ${res.status}`);
    const json = (await res.json()) as { values?: string[][] };
    return json.values ?? [];
  }

  /** Overwrite a tab starting at A1 with the given grid. */
  async updateValues(tab: string, values: string[][]): Promise<void> {
    const range = `${tab}!A1`;
    const url =
      `${BASE}/${this.spreadsheetId}/values/${encodeURIComponent(range)}` +
      `?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${await this.token()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ values }),
    });
    if (!res.ok) throw new Error(`Sheets updateValues ${tab} failed: ${res.status}`);
  }
}

/** Build a client from env, or null if Sheets isn't configured. */
export function sheetsClientFromEnv(): SheetsClient | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!raw || !spreadsheetId) return null;
  const creds = JSON.parse(raw) as { client_email: string; private_key: string };
  return new SheetsClient({
    clientEmail: creds.client_email,
    privateKey: creds.private_key.replace(/\\n/g, '\n'),
    spreadsheetId,
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/lib/sheets-client.test.ts"`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/lib/sheets/client.ts tests/unit/lib/sheets-client.test.ts
git commit -m "feat(sheets-sync): SheetsClient — JWT auth + REST get/update (TDD)"
```

---

## Task 7: DB snapshot + apply queries

**Files:**
- Create: `src/server/queries/sheet-snapshot.ts`

Reads the three tables into `TableSnapshot`s (flattening jsonb `name`/`description` into `name.th` etc.) and applies `ApplyOp`s per table in a transaction-like batch via the service role, bumping `version` and recomputing derived `tracking_url`.

- [ ] **Step 1: Write the module**

```ts
import 'server-only';
import { createServiceRoleSupabase } from '@/db/server';
import { buildTrackingUrl } from '@/domain/carriers';
import type { ApplyOp } from '@/domain/sheets-sync/diff';
import { SCHEMAS, type SyncTable, type TableSnapshot } from '@/domain/sheets-sync/schema';

type Json = Record<string, unknown>;
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const loc = (j: unknown, k: 'th' | 'en'): string => s((j as Json | null)?.[k]);

/** Build the snapshot for one table directly from the DB (DB is source of truth). */
export async function readSnapshot(table: SyncTable): Promise<TableSnapshot> {
  const svc = createServiceRoleSupabase();
  if (table === 'products') {
    const { data } = await svc
      .from('products')
      .select('id, version, slug, name, description, base_price_thb, status')
      .order('created_at', { ascending: true });
    return {
      table,
      rows: (data ?? []).map((r) => ({
        pk: r.id,
        version: r.version,
        values: {
          slug: s(r.slug),
          'name.th': loc(r.name, 'th'),
          'name.en': loc(r.name, 'en'),
          'description.th': loc(r.description, 'th'),
          'description.en': loc(r.description, 'en'),
          base_price_thb: s(r.base_price_thb),
          status: s(r.status),
        },
      })),
    };
  }
  if (table === 'variants') {
    const { data } = await svc
      .from('variants')
      .select('id, version, sku, price_thb, stock_available, is_active')
      .order('created_at', { ascending: true });
    return {
      table,
      rows: (data ?? []).map((r) => ({
        pk: r.id,
        version: r.version,
        values: {
          sku: s(r.sku),
          price_thb: s(r.price_thb),
          stock_available: s(r.stock_available),
          is_active: r.is_active ? 'TRUE' : 'FALSE',
        },
      })),
    };
  }
  const { data } = await svc
    .from('orders')
    .select('id, version, number, customer_email, ship_status, tracking_carrier, tracking_number, notes_to_buyer')
    .order('created_at', { ascending: true });
  return {
    table,
    rows: (data ?? []).map((r) => ({
      pk: r.id,
      version: r.version,
      values: {
        number: s(r.number),
        customer_email: s(r.customer_email),
        ship_status: s(r.ship_status),
        tracking_carrier: s(r.tracking_carrier),
        tracking_number: s(r.tracking_number),
        notes_to_buyer: s(r.notes_to_buyer),
      },
    })),
  };
}

/** Flat column→value payload for variants/orders (products is handled inline in
 *  applyOps because it merges jsonb name/description). */
function toDbPayload(table: 'variants' | 'orders', changes: Record<string, unknown>): Json {
  const allowed =
    table === 'variants'
      ? (['price_thb', 'stock_available', 'is_active'] as const)
      : (['ship_status', 'tracking_carrier', 'tracking_number', 'notes_to_buyer'] as const);
  const out: Json = {};
  for (const k of allowed) {
    if (k in changes) out[k] = changes[k];
  }
  return out;
}

/** Apply one table's ApplyOps. Each op reads-merges jsonb where needed, bumps version. */
export async function applyOps(table: SyncTable, ops: ApplyOp[]): Promise<void> {
  const svc = createServiceRoleSupabase();
  for (const op of ops) {
    if (table === 'products') {
      const { data: cur } = await svc
        .from('products')
        .select('name, description')
        .eq('id', op.pk)
        .single();
      const payload: Json = { version: op.nextVersion };
      const name = { ...((cur?.name as Json) ?? {}) };
      const desc = { ...((cur?.description as Json) ?? {}) };
      if ('name.th' in op.changes) name.th = op.changes['name.th'];
      if ('name.en' in op.changes) name.en = op.changes['name.en'];
      if ('description.th' in op.changes) desc.th = op.changes['description.th'];
      if ('description.en' in op.changes) desc.en = op.changes['description.en'];
      if ('name.th' in op.changes || 'name.en' in op.changes) payload.name = name;
      if ('description.th' in op.changes || 'description.en' in op.changes) payload.description = desc;
      if ('base_price_thb' in op.changes) payload.base_price_thb = op.changes['base_price_thb'];
      if ('status' in op.changes) payload.status = op.changes['status'];
      await svc.from('products').update(payload).eq('id', op.pk);
    } else if (table === 'variants') {
      await svc
        .from('variants')
        .update({ ...toDbPayload(table, op.changes), version: op.nextVersion })
        .eq('id', op.pk);
    } else {
      const payload = { ...toDbPayload(table, op.changes), version: op.nextVersion } as Json;
      // Recompute derived tracking_url when carrier/number changed.
      if ('tracking_carrier' in op.changes || 'tracking_number' in op.changes) {
        const { data: cur } = await svc
          .from('orders')
          .select('tracking_carrier, tracking_number')
          .eq('id', op.pk)
          .single();
        const carrier = (op.changes['tracking_carrier'] as string) ?? cur?.tracking_carrier ?? '';
        const number = (op.changes['tracking_number'] as string) ?? cur?.tracking_number ?? '';
        payload.tracking_url = carrier && number ? buildTrackingUrl(carrier, number) : null;
      }
      await svc.from('orders').update(payload).eq('id', op.pk);
    }
  }
}

export const SYNC_TABLES = Object.keys(SCHEMAS) as SyncTable[];
```

- [ ] **Step 2: Typecheck**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && \$HOME/.bun/bin/bun run tsc --noEmit 2>&1 | tail -8"`
Expected: no errors. (`products` rows are handled inline in `applyOps`; `toDbPayload` only covers `variants`/`orders`.)

- [ ] **Step 3: Commit**

```bash
git add src/server/queries/sheet-snapshot.ts
git commit -m "feat(sheets-sync): DB snapshot read + per-table apply (version bump, tracking_url)"
```

---

## Task 8: Sync orchestrator action

**Files:**
- Create: `src/server/actions/sync-sheets.ts`
- Test: `tests/unit/server/sync-sheets.test.ts`

Dev-only. Enforces the 5-minute debounce, runs the cycle, writes the audit rows. The SheetsClient and snapshot/apply layers are injected so the action is testable.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const apply = vi.fn(async () => {});
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

const runSync = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
});

describe('runSheetSync (pure cycle)', () => {
  it('applies an allow-listed sheet edit and reports counts', async () => {
    const { runSheetSyncCycle } = await import('@/server/actions/sync-sheets');
    read.mockResolvedValue({
      table: 'variants',
      rows: [{ pk: 'v1', version: 2, values: { sku: 'TEE', price_thb: '500', stock_available: '10', is_active: 'TRUE' } }],
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
```

Expose a pure-ish `runSheetSyncCycle(client)` (no auth/debounce/DB-audit) that the test drives, plus the public `syncSheets()` server action that wraps it with `requireDev`, debounce, and audit writes.

- [ ] **Step 2: Run test to verify it fails**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/server/sync-sheets.test.ts"`
Expected: FAIL — cannot resolve `@/server/actions/sync-sheets`.

- [ ] **Step 3: Write the implementation**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { requireDev } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { diffSnapshots } from '@/domain/sheets-sync/diff';
import { gridToRows, rowsToGrid } from '@/domain/sheets-sync/cells';
import { SCHEMAS, type TableSnapshot } from '@/domain/sheets-sync/schema';
import type { SheetsClient } from '@/lib/sheets/client';
import { sheetsClientFromEnv } from '@/lib/sheets/client';
import { applyOps, readSnapshot, SYNC_TABLES } from '@/server/queries/sheet-snapshot';

const DEBOUNCE_MS = 5 * 60_000;

export interface CycleResult {
  pulled: number;
  applied: number;
  rejected: number;
  rejects: { table_name: string; row_pk: string; column_name: string; reason: string; attempted_value: string }[];
}

/** The reconciliation cycle, given a live client. No auth/debounce/audit. */
export async function runSheetSyncCycle(client: Pick<SheetsClient, 'getValues' | 'updateValues'>): Promise<CycleResult> {
  let pulled = 0;
  let applied = 0;
  const rejects: CycleResult['rejects'] = [];

  for (const table of SYNC_TABLES) {
    const schema = SCHEMAS[table];
    const grid = await client.getValues(schema.tab);
    const sheetSnap: TableSnapshot = { table, rows: gridToRows(grid, schema) };
    pulled += sheetSnap.rows.length;
    const dbSnap = await readSnapshot(table);

    const diff = diffSnapshots(dbSnap, sheetSnap, schema);
    if (diff.applies.length > 0) await applyOps(table, diff.applies);
    applied += diff.applies.length;
    rejects.push(...diff.rejects);

    // Push the fresh authoritative snapshot back so the sheet can't drift.
    const fresh = await readSnapshot(table);
    await client.updateValues(schema.tab, rowsToGrid(fresh.rows, schema));
  }

  return { pulled, applied, rejected: rejects.length, rejects };
}

export async function syncSheets(): Promise<{ ok: true; applied: number; rejected: number } | { error: string }> {
  const supa = await createServerSupabase();
  await requireDev(supa);

  const client = sheetsClientFromEnv();
  if (!client) return { error: 'Sheets not configured (set GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_SHEETS_SPREADSHEET_ID)' };

  const svc = createServiceRoleSupabase();
  const since = new Date(Date.now() - DEBOUNCE_MS).toISOString();
  const { data: recent } = await svc
    .from('sheet_sync_runs')
    .select('id')
    .gt('started_at', since)
    .limit(1);
  if (recent && recent.length > 0) return { error: 'A sync ran in the last 5 minutes — try again shortly.' };

  const { data: run } = await svc
    .from('sheet_sync_runs')
    .insert({ trigger: 'manual', status: 'running' })
    .select('id')
    .single();
  const runId = run?.id as string;

  try {
    const result = await runSheetSyncCycle(client);
    if (result.rejects.length > 0) {
      await svc.from('sheet_sync_rejects').insert(
        result.rejects.map((r) => ({ ...r, run_id: runId })),
      );
    }
    await svc
      .from('sheet_sync_runs')
      .update({
        status: 'ok',
        rows_pulled: result.pulled,
        rows_applied: result.applied,
        rows_rejected: result.rejected,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);
    revalidatePath('/admin/sync');
    return { ok: true, applied: result.applied, rejected: result.rejected };
  } catch (err) {
    await svc
      .from('sheet_sync_runs')
      .update({ status: 'error', error: err instanceof Error ? err.message : 'unknown', finished_at: new Date().toISOString() })
      .eq('id', runId);
    revalidatePath('/admin/sync');
    return { error: err instanceof Error ? err.message : 'Sync failed' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/vitest.sh tests/unit/server/sync-sheets.test.ts"`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/sync-sheets.ts tests/unit/server/sync-sheets.test.ts
git commit -m "feat(sheets-sync): dev-only orchestrator action — debounce + audit (TDD)"
```

---

## Task 9: Dev-only admin sync screen

**Files:**
- Create: `src/app/admin/sync/page.tsx`
- Create: `src/components/admin/SyncPanel.tsx`

- [ ] **Step 1: Write the client panel**

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { syncSheets } from '@/server/actions/sync-sheets';

export function SyncPanel() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  return (
    <div className="space-y-3">
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await syncSheets();
            if ('error' in res) setMsg({ tone: 'error', text: res.error });
            else setMsg({ tone: 'ok', text: `Synced — ${res.applied} applied, ${res.rejected} rejected.` });
          })
        }
      >
        {pending ? 'Syncing…' : 'Sync now'}
      </Button>
      {msg && (
        <p className={`text-sm ${msg.tone === 'ok' ? 'text-success' : 'text-error'}`}>{msg.text}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the page (dev-only, run history)**

```tsx
import { notFound } from 'next/navigation';
import { SyncPanel } from '@/components/admin/SyncPanel';
import { getCurrentRole } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default async function AdminSyncPage() {
  const supa = await createServerSupabase();
  const role = await getCurrentRole(supa);
  if (role !== 'dev') notFound(); // dev-only screen

  const { data: runs } = await supa
    .from('sheet_sync_runs')
    .select('id, status, rows_pulled, rows_applied, rows_rejected, error, started_at, finished_at')
    .order('started_at', { ascending: false })
    .limit(20);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl text-ink">Sheets sync</h1>
        <p className="text-sm text-muted">
          Reconcile the Google Sheet with the database. The DB is authoritative; the sheet is
          overwritten with a fresh snapshot every run.
        </p>
      </div>

      <SyncPanel />

      <div className="overflow-hidden rounded-lg border border-line bg-paper">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Pulled</th>
              <th className="px-4 py-3 font-medium">Applied</th>
              <th className="px-4 py-3 font-medium">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {(runs ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-3 text-muted" colSpan={5}>
                  No syncs yet.
                </td>
              </tr>
            )}
            {(runs ?? []).map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink">{dateFmt.format(new Date(r.started_at))}</td>
                <td className="px-4 py-3 text-ink-soft">{r.error ? `error: ${r.error}` : r.status}</td>
                <td className="px-4 py-3 text-ink-soft">{r.rows_pulled}</td>
                <td className="px-4 py-3 text-ink-soft">{r.rows_applied}</td>
                <td className="px-4 py-3 text-ink-soft">{r.rows_rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `wsl -d Ubuntu -- bash -lc "cd /home/ton/workspace/rb_shop && export PATH=\"\$HOME/.local/bin:\$HOME/.bun/bin:\$PATH\" && bun run tsc --noEmit 2>&1 | tail -6 && bun run biome check --write src/app/admin/sync/ src/components/admin/SyncPanel.tsx 2>&1 | tail -3"`
Expected: no type errors; biome clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/sync/page.tsx src/components/admin/SyncPanel.tsx
git commit -m "feat(admin): dev-only Sheets sync screen — Sync now + run history"
```

---

## Task 10: Admin nav (dev-only) + env + README + final gate

**Files:**
- Modify: `src/components/admin/AdminNav.tsx`
- Modify: `.env.example`, `README.md`

- [ ] **Step 1: Add a dev-only nav link**

The current `AdminNav` is a server component rendering a static `NAV_LINKS` list. Make it `async`, read the role, and append the Sync link only for `dev`:

```tsx
import Link from 'next/link';
import { getCurrentRole } from '@/db/auth';
import { createServerSupabase } from '@/db/server';
import { signOutAdmin } from '@/server/actions/auth';

const NAV_LINKS = [
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/discounts', label: 'Discounts' },
  { href: '/admin/waitlists', label: 'Waitlists' },
];

const linkClass =
  'relative transition-colors duration-150 ease-out-soft after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 after:ease-out-soft hover:text-ink hover:after:scale-x-100';

export async function AdminNav() {
  const supa = await createServerSupabase();
  const role = await getCurrentRole(supa);
  const links = role === 'dev' ? [...NAV_LINKS, { href: '/admin/sync', label: 'Sync' }] : NAV_LINKS;

  return (
    <header className="border-b border-line bg-paper">
      <div className="container mx-auto flex h-16 items-center justify-between px-6">
        <Link href="/admin" className="font-serif text-lg text-ink">
          admin
        </Link>
        <nav className="flex items-center gap-6 text-sm text-ink-soft">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass}>
              {l.label}
            </Link>
          ))}
          <form action={signOutAdmin}>
            <button
              type="submit"
              className="text-muted transition-colors duration-150 ease-out-soft hover:text-ink active:scale-95"
            >
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Add env vars to `.env.example`**

Append:
```
# Google Sheets sync (Plan 5). Omit to disable sync.
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_SHEETS_SPREADSHEET_ID=
```

- [ ] **Step 3: Add a README section** (after the "Background jobs" section)

```markdown
## Google Sheets sync (dev-only)

A safe two-way sync between the DB and a Google Sheet for products, variants, and
orders. The DB is authoritative; the sheet is overwritten with a fresh snapshot
every run. Only allow-listed columns can be written back; everything else is
read-only and stale edits are rejected (logged in the run history).

Setup: create a Google Cloud service account, download its JSON key, share your
sheet with the service-account email as **Editor**, then set:

    GOOGLE_SERVICE_ACCOUNT_JSON='{"client_email":"...","private_key":"..."}'
    GOOGLE_SHEETS_SPREADSHEET_ID=<id from the sheet URL>

Trigger from `/admin/sync` (dev role only) with "Sync now" (debounced 5 min).
```

- [ ] **Step 4: Run the full gate**

Write `\\wsl.localhost\Ubuntu\tmp\p5-gate.sh`:
```bash
#!/usr/bin/env bash
cd /home/ton/workspace/rb_shop
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
echo "=== typecheck ==="; bun run tsc --noEmit 2>&1 | tail -6 && echo TSC_OK
echo "=== lint ==="; bun run biome check . 2>&1 | tail -4
echo "=== tests ==="; bun run vitest run 2>&1 | tail -8
echo "=== build ==="; node ./node_modules/next/dist/bin/next build 2>&1 | grep -vE 'unique .key. prop|warning-keys|top-level render' | tail -12
```
Run: `wsl -d Ubuntu -- bash -lc "bash /tmp/p5-gate.sh"`
Expected: typecheck clean, biome clean, all tests pass (incl. new cells/diff/client/sync), build succeeds with `/admin/sync` listed.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/AdminNav.tsx README.md
git commit -m "feat(admin): dev-only Sync nav link + docs; Plan 5 core complete"
```

---

## Out of scope (Plan 5b and later)

| Concern | Plan |
|---|---|
| In-admin setup wizard + DB `settings` table | 5b |
| Cron trigger (combined dispatcher for Vercel Hobby limits) | 5b |
| Cell-comment writeback for rejects | 5b |
| `discount_codes`, `shipping_zones`, `waitlist` tabs | 5b |
| Row creation/deletion from the sheet (currently update-only) | 5b |
| Real PSP/FFP, security headers, Turnstile, E2E, prod deploy | 6 |
