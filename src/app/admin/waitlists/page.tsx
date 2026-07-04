import { getTranslations } from 'next-intl/server';
import { AdminSearchForm } from '@/components/admin/AdminSearchForm';
import { WaitlistsTable } from '@/components/admin/WaitlistsTable';
import { listWaitlistGroups } from '@/server/queries/admin-waitlists';

export default async function AdminWaitlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() || undefined;
  const t = await getTranslations('admin.waitlists');
  const groups = await listWaitlistGroups(search);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
        <p className="text-sm text-muted">{t('description')}</p>
      </div>
      <AdminSearchForm
        action="/admin/waitlists"
        placeholder={t('searchPlaceholder')}
        search={search}
        clearHref="/admin/waitlists"
      />
      <WaitlistsTable groups={groups} />
    </div>
  );
}
