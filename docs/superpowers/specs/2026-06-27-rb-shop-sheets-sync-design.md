# rb_shop — Plan 5 design: Google Sheets sync (core engine)

**Status:** Design approved 2026-06-27. Ready for plan.
**Parent spec:** [2026-06-26-rb-shop-design.md](2026-06-26-rb-shop-design.md) §6.8.

## Goal

Give rainbykello a familiar spreadsheet as a **second interface** to the store's
operational data. She edits a Google Sheet; a safe two-way sync reconciles it
with the database. The **database is always the source of truth** — the sheet is
overwritten with a fresh DB snapshot at the end of every sync, so it can never
silently drift.

This plan delivers the **core sync engine** only. Deferred to Plan 5b: the
in-admin setup wizard, a DB `settings` table, cron triggering, cell-comment
writeback, and the `discount_codes` / `shipping_zones` / `waitlist` tabs.

## Locked decisions

| Decision | Choice |
|---|---|
| Scope | Core engine: DB→Sheet push + Sheet→DB pull, writeback-allowlist, version concurrency, audit tables, manual trigger |
| Tables | `products`, `variants`, `orders` (one tab each) |
| Google client | `google-auth-library` (service-account JWT) + `fetch` to the Sheets REST API |
| Config | Env vars — `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_SPREADSHEET_ID` (no DB settings table yet) |
| Trigger | Manual "Sync now" button on a **dev-only** admin screen, debounced (5-min minimum between runs) |
| Rejects | Logged to `sheet_sync_rejects` and surfaced in the admin run detail (no cell-comment writeback yet) |
| Run cap | A single run applies at most **500 row diffs** (fail-safe against runaway edits) |
| Engine architecture | Pure diff core in `src/domain/sheets-sync/` + thin I/O adapters (Approach A) |

## Architecture

Approach A — a **pure diff core** with **thin I/O adapters** at the edges. The
safety-critical logic (writeback-allowlist, version concurrency, validation) is a
pure function with no I/O, fully unit-tested. I/O lives in small adapters the
orchestrator wires together.

```
src/
  domain/sheets-sync/
    schema.ts        Per-table tab definition: columns, primary key, writeback-allowlist,
                     and a Zod validator per writeback column. Pure data + types.
    diff.ts          diffSnapshots(db, sheet, schema, now) → { applies, rejects, counts }
                     Pure. Enforces allowlist, version concurrency, Zod validation, run cap.
    cells.ts         Column ⇄ A1 cell mapping, value (de)serialization for the sheet grid.
  lib/sheets/
    client.ts        SheetsClient: service-account JWT auth + REST getValues/updateValues.
                     server-only. The only thing that talks to Google.
  server/
    queries/sheet-snapshot.ts   Read products/variants/orders → normalized row snapshots.
    actions/sync-sheets.ts      Dev-only orchestrator (see Sync cycle).
  app/admin/sync/
    page.tsx         Dev-only screen: Sync now + last-run summary + run history.
    SyncPanel.tsx    Client island: triggers the action, shows pending/result.
supabase/migrations/
    ..._sheet_sync.sql          sheet_sync_runs + sheet_sync_rejects + RLS + grants.
```

### Components and boundaries

- **`domain/sheets-sync` (pure, no I/O).** Given a DB snapshot and a sheet
  snapshot, produce the list of allowed applies and the list of rejects with
  reasons. Knows nothing about Google or Postgres. Independently testable.
- **`lib/sheets/client.ts` (I/O).** Wraps auth + REST. Inputs: spreadsheet id,
  range. Outputs: 2-D value arrays. Mockable in tests by swapping the client.
- **`server/queries/sheet-snapshot.ts` (I/O).** Turns DB rows into the same
  normalized row shape the diff core expects.
- **`server/actions/sync-sheets.ts` (orchestration).** Thin: enforces dev role +
  debounce, calls the adapters and the pure core in order, persists the audit
  rows. Holds no business rules itself.

## Data model

No change to existing tables — `products`, `variants`, `orders` already carry a
`version` column for optimistic concurrency. Two new audit tables:

```sql
create table public.sheet_sync_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('manual')),   -- 'cron' added in 5b
  status text not null check (status in ('running','ok','error')),
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
  reason text not null,            -- 'read_only' | 'version_stale' | 'validation' | 'run_cap'
  attempted_value text,
  created_at timestamptz not null default now()
);
```

RLS: both tables are **dev-only** read (`is_owner_or_dev()` is too broad — these
are diagnostics, so restrict to `dev` via a `is_dev()`-style check; if no such
helper exists, the plan adds one). `service_role` full access for the action.

## Sync cycle (manual trigger)

```
0. Require dev role. Reject if a run started < 5 min ago (debounce).
1. Insert sheet_sync_runs row (status='running').
2. PULL sheet snapshot (SheetsClient.getValues per tab).
3. PULL DB snapshot (sheet-snapshot queries).
4. DIFF (pure): for each (table, row, column)
     - column not in writeback-allowlist → reject 'read_only'
     - sheet row version != DB version   → reject 'version_stale'
     - Zod validator fails               → reject 'validation'
     - cumulative applies > 500          → reject 'run_cap'
     - else                              → queue apply (bumps version on write)
5. APPLY queued diffs per table in a transaction (service role).
6. PUSH fresh DB snapshot back to every tab (overwrite — sheet can't drift).
7. Persist rejects; finalize run (status='ok', counts, finished_at).
   On any thrown error: status='error', record message, still finalize.
```

## Error handling

- **Auth/REST failure** → run marked `error`, message stored, nothing applied
  (we fail before step 5, or the per-table transaction rolls back).
- **Partial table failure** → each table applies in its own transaction; a
  failure in one table doesn't corrupt others; the run records the error.
- **Stale edits** → never applied; logged as `version_stale`; the step-6
  overwrite restores the authoritative value in the sheet.
- **Runaway edit** → run cap (500) stops the bleed; excess queued as `run_cap`
  rejects rather than applied.
- **Missing env config** → action returns a clear "Sheets not configured" error;
  the admin screen shows setup guidance.

## Writeback-allowlist (this slice)

| Table | Writeback columns | Read-only (everything else) |
|---|---|---|
| products | `name.th`, `name.en`, `description.th`, `description.en`, `base_price_thb`, `status` | id, slug, timestamps, version, … |
| variants | `price_thb`, `stock_available`, `is_active` | sku, option_values, stock_reserved, … |
| orders | `ship_status`, `tracking_carrier`, `tracking_number`, `notes_to_buyer` | totals, address, status, … |

When a `tracking_carrier` or `tracking_number` edit is applied, the orchestrator
recomputes the derived `tracking_url` via `buildTrackingUrl` (same as the admin
ship form) — `tracking_url` itself is never sheet-writable.

## Testing

- **Pure diff core (TDD):** allowlist enforcement (read-only column rejected),
  version-stale rejection, Zod-validation rejection, run-cap rejection, happy-path
  apply, version bump on apply, mixed batch (some apply / some reject).
- **cells.ts (TDD):** column↔A1 mapping, value (de)serialization round-trips
  (numbers, booleans, nested `name.th`).
- **SheetsClient:** unit test with `fetch`/auth mocked — builds correct ranges and
  parses value arrays; not hit in the diff tests.
- **Orchestrator:** action-level test with the SheetsClient + DB adapters mocked,
  asserting the run/reject rows written for a representative mixed batch.

## Out of scope (Plan 5b and later)

| Concern | Plan |
|---|---|
| In-admin setup wizard + DB `settings` table | 5b |
| Cron trigger (combined dispatcher for Vercel Hobby limits) | 5b |
| Cell-comment writeback for rejects | 5b |
| `discount_codes`, `shipping_zones`, `waitlist` tabs | 5b |
| Real PSP/FFP, security headers, Turnstile, E2E, prod deploy | 6 |
