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

      const base = {
        table_name: schema.table,
        row_pk: sheetRow.pk,
        column_name: col.key,
        attempted_value: sheetVal,
      };
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
      applies.push({
        table: schema.table,
        pk: sheetRow.pk,
        nextVersion: dbRow.version + 1,
        changes,
      });
    }
  }

  return { applies, rejects, counts: { applied: applies.length, rejected: rejects.length } };
}
