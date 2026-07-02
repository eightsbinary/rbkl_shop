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
    grid.push([row.pk, String(row.version), ...schema.columns.map((c) => row.values[c.key] ?? '')]);
  }
  return grid;
}
