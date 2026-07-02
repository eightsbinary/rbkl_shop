'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { sheetsClientFromEnv } from '@/lib/sheets/client';
import { runSheetSyncCycle } from '@/server/sheets/cycle';

const DEBOUNCE_MS = 5 * 60_000;

export async function syncSheets(): Promise<
  { ok: true; applied: number; rejected: number } | { error: string }
> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

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
  const runId = run?.id;
  if (!runId) return { error: 'Could not start a sync run — please try again.' };

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
