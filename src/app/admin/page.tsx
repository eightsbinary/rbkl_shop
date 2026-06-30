import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCurrentRole } from '@/db/auth';
import { createServerSupabase } from '@/db/server';

export default async function AdminHome() {
  const supa = await createServerSupabase();
  const role = await getCurrentRole(supa);
  const t = await getTranslations('admin.dashboard');
  const nav = await getTranslations('admin.nav');

  const sections = [
    { href: '/admin/products', label: nav('products') },
    { href: '/admin/orders', label: nav('orders') },
    { href: '/admin/discounts', label: nav('discounts') },
    { href: '/admin/waitlists', label: nav('waitlists') },
    { href: '/admin/settings', label: nav('settings') },
    { href: '/admin/about', label: nav('about') },
    ...(role === 'dev' ? [{ href: '/admin/sync', label: nav('sync') }] : []),
  ];

  return (
    <div className="space-y-12">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{t('badge')}</p>
        <h1 className="font-serif text-4xl text-ink">{t('welcome')}</h1>
        <p className="max-w-xl text-ink-soft">
          {t.rich('intro', {
            link: (chunks) => (
              <Link href="/admin/products" className="text-ink underline underline-offset-4">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </header>

      {/* gap-px on a bg-line grid paints hairline dividers between tiles */}
      <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex items-center justify-between bg-surface px-6 py-8 transition-colors duration-150 ease-out-soft hover:bg-field"
          >
            <span className="font-serif text-xl text-ink">{s.label}</span>
            <span className="text-muted transition-transform duration-150 ease-out-soft group-hover:translate-x-1">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
