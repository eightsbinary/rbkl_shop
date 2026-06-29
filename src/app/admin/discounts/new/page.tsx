import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DiscountForm } from '@/components/admin/DiscountForm';

export default async function NewDiscountPage() {
  const t = await getTranslations('admin.discounts');

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin/discounts"
          className="text-sm text-muted transition-colors duration-150 ease-out-soft hover:text-ink"
        >
          {t('backLink')}
        </Link>
        <h1 className="font-serif text-3xl text-ink">{t('newTitle')}</h1>
      </div>
      <DiscountForm mode="create" />
    </div>
  );
}
