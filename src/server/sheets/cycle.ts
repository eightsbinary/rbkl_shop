import 'server-only';
import { gridToRows, rowsToGrid } from '@/domain/sheets-sync/cells';
import { type ChangeDetail, diffSnapshots } from '@/domain/sheets-sync/diff';
import { SCHEMAS, type TableSnapshot } from '@/domain/sheets-sync/schema';
import type { SheetsClient } from '@/lib/sheets/client';
import { applyOps, readSnapshot, SYNC_TABLES } from '@/server/queries/sheet-snapshot';

export interface CycleResult {
  pulled: number;
  applied: number;
  rejected: number;
  rejects: {
    table_name: string;
    row_pk: string;
    column_name: string;
    reason: string;
    attempted_value: string;
  }[];
  /** Cell-level old → new for every (would-be) applied change. */
  details: ChangeDetail[];
}

/**
 * The reconciliation cycle, given a live client. No auth/debounce/audit — the
 * caller (`syncSheets`) owns those. This lives outside the `'use server'` module
 * on purpose so it is NOT exposed as a callable server action.
 *
 * `dryRun` computes the full diff but writes nothing — no DB applies and no
 * snapshot push-back — so the admin can preview exactly what a real run would
 * change before committing.
 */
export async function runSheetSyncCycle(
  client: Pick<SheetsClient, 'getValues' | 'updateValues'>,
  opts: { dryRun?: boolean } = {},
): Promise<CycleResult> {
  let pulled = 0;
  let applied = 0;
  const rejects: CycleResult['rejects'] = [];
  const details: ChangeDetail[] = [];

  for (const table of SYNC_TABLES) {
    const schema = SCHEMAS[table];
    const grid = await client.getValues(schema.tab);
    const sheetSnap: TableSnapshot = { table, rows: gridToRows(grid, schema) };
    pulled += sheetSnap.rows.length;
    const dbSnap = await readSnapshot(table);

    const diff = diffSnapshots(dbSnap, sheetSnap, schema);
    if (!opts.dryRun && diff.applies.length > 0) await applyOps(table, diff.applies);
    applied += diff.applies.length;
    rejects.push(...diff.rejects);
    details.push(...diff.details);

    if (!opts.dryRun) {
      // Push the fresh authoritative snapshot back so the sheet can't drift.
      const fresh = await readSnapshot(table);
      await client.updateValues(schema.tab, rowsToGrid(fresh.rows, schema));
    }
  }

  return { pulled, applied, rejected: rejects.length, rejects, details };
}
