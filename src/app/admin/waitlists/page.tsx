import { getTranslations } from 'next-intl/server';
import { WaitlistsTable } from '@/components/admin/WaitlistsTable';
import { listWaitlistGroups } from '@/server/queries/admin-waitlists';

export default async function AdminWaitlistsPage() {
  const t = await getTranslations('admin.waitlists');
  const groups = await listWaitlistGroups();

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
        <p className="text-sm text-muted">{t('description')}</p>
      </div>
      <WaitlistsTable groups={groups} />
    </div>
  );
}
