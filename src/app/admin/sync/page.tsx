import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SyncPanel } from '@/components/admin/SyncPanel';
import { getCurrentRole } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default async function AdminSyncPage() {
  const t = await getTranslations('admin.sync');
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
        <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
        <p className="text-sm text-muted">{t('description')}</p>
      </div>

      <SyncPanel />

      <div className="overflow-hidden rounded-lg border border-line bg-paper">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{t('colWhen')}</th>
              <th className="px-4 py-3 font-medium">{t('colStatus')}</th>
              <th className="px-4 py-3 font-medium">{t('colPulled')}</th>
              <th className="px-4 py-3 font-medium">{t('colApplied')}</th>
              <th className="px-4 py-3 font-medium">{t('colRejected')}</th>
            </tr>
          </thead>
          <tbody>
            {(runs ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-3 text-muted" colSpan={5}>
                  {t('empty')}
                </td>
              </tr>
            )}
            {(runs ?? []).map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink">{dateFmt.format(new Date(r.started_at))}</td>
                <td className="px-4 py-3 text-ink-soft">
                  {r.error ? t('errorRow', { error: r.error }) : r.status}
                </td>
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
