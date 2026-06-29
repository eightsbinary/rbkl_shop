import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function AdminHome() {
  const t = await getTranslations('admin.dashboard');
  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl text-ink">{t('welcome')}</h1>
      <p className="text-ink-soft">
        {t.rich('intro', {
          link: (chunks) => (
            <Link href="/admin/products" className="underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
