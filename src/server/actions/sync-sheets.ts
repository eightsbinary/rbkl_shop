'use server';

import { revalidatePath } from 'next/cache';
import { requireDev } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { gridToRows, rowsToGrid } from '@/domain/sheets-sync/cells';
import { diffSnapshots } from '@/domain/sheets-sync/diff';
import { SCHEMAS, type TableSnapshot } from '@/domain/sheets-sync/schema';
import type { SheetsClient } from '@/lib/sheets/client';
import { sheetsClientFromEnv } from '@/lib/sheets/client';
import { applyOps, readSnapshot, SYNC_TABLES } from '@/server/queries/sheet-snapshot';

const DEBOUNCE_MS = 5 * 60_000;

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
}

/** The reconciliation cycle, given a live client. No auth/debounce/audit. */
export async function runSheetSyncCycle(
  client: Pick<SheetsClient, 'getValues' | 'updateValues'>,
): Promise<CycleResult> {
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

export async function syncSheets(): Promise<
  { ok: true; applied: number; rejected: number } | { error: string }
> {
  const supa = await createServerSupabase();
  await requireDev(supa);

  const client = sheetsClientFromEnv();
  if (!client)
    return {
      error:
        'Sheets not configured (set GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_SHEETS_SPREADSHEET_ID)',
    };

  const svc = createServiceRoleSupabase();
  const since = new Date(Date.now() - DEBOUNCE_MS).toISOString();
  const { data: recent } = await svc
    .from('sheet_sync_runs')
    .select('id')
    .gt('started_at', since)
    .limit(1);
  if (recent && recent.length > 0)
    return { error: 'A sync ran in the last 5 minutes — try again shortly.' };

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
        // biome-ignore lint/suspicious/noExplicitAny: dynamic Supabase payload — columns are runtime-determined
        result.rejects.map((r) => ({ ...r, run_id: runId })) as any,
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
      .update({
        status: 'error',
        error: err instanceof Error ? err.message : 'unknown',
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId);
    revalidatePath('/admin/sync');
    return { error: err instanceof Error ? err.message : 'Sync failed' };
  }
}
