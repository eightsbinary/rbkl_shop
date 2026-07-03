import { getTranslations } from 'next-intl/server';
import { AdminSearchForm } from '@/components/admin/AdminSearchForm';
import { NewsletterTable } from '@/components/admin/NewsletterTable';
import { listNewsletterSubscribers } from '@/server/queries/admin-newsletter';

export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() || undefined;
  const t = await getTranslations('admin.newsletter');
  const subscribers = await listNewsletterSubscribers(search);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
          <p className="text-sm text-muted">{t('description')}</p>
        </div>
        <a
          href="/api/admin/newsletter/export"
          className="border border-ink px-4 py-2 text-xs uppercase tracking-[0.12em] text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          {t('download')}
        </a>
      </div>
      <AdminSearchForm
        action="/admin/newsletter"
        placeholder={t('searchPlaceholder')}
        search={search}
        clearHref="/admin/newsletter"
      />
      <NewsletterTable subscribers={subscribers} />
    </div>
  );
}
