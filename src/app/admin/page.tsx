import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { getSalesDashboard } from '@/server/queries/sales-summary';

export default async function AdminHome() {
  const t = await getTranslations('admin.dashboard');
  const nav = await getTranslations('admin.nav');
  const locale = (await getLocale()) === 'th' ? 'th' : 'en';
  const { summary, awaitingPayment, top } = await getSalesDashboard();

  const thb = (n: number) => `฿${n.toLocaleString()}`;
  const revenueTiles = [
    { label: t('stats.today'), stats: summary.today },
    { label: t('stats.last7d'), stats: summary.last7d },
    { label: t('stats.last30d'), stats: summary.last30d },
    { label: t('stats.allTime'), stats: summary.allTime },
  ];
  const countTiles = [
    { label: t('stats.aov'), value: thb(summary.aovThb) },
    { label: t('stats.awaitingPayment'), value: awaitingPayment.toLocaleString() },
    { label: t('stats.toShip'), value: summary.toShip.toLocaleString() },
  ];

  const sections = [
    { href: '/admin/products', label: nav('products') },
    { href: '/admin/orders', label: nav('orders') },
    { href: '/admin/discounts', label: nav('discounts') },
    { href: '/admin/waitlists', label: nav('waitlists') },
    { href: '/admin/settings', label: nav('settings') },
    { href: '/admin/home', label: nav('home') },
    { href: '/admin/about', label: nav('about') },
    { href: '/admin/sync', label: nav('sync') },
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

      {/* Sales at a glance — revenue by period, then operational counts. */}
      <section className="space-y-px">
        <h2 className="sr-only">{t('stats.heading')}</h2>
        <div className="grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4">
          {revenueTiles.map((tile) => (
            <div key={tile.label} className="space-y-1 bg-surface px-6 py-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">{tile.label}</p>
              <p className="font-serif text-2xl text-ink">{thb(tile.stats.revenueThb)}</p>
              <p className="text-xs text-muted">
                {t('stats.orderCount', { count: tile.stats.orders })}
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-px border border-t-0 border-line bg-line">
          {countTiles.map((tile) => (
            <div key={tile.label} className="space-y-1 bg-surface px-6 py-5">
              <p className="text-xs uppercase tracking-[0.14em] text-muted">{tile.label}</p>
              <p className="font-serif text-2xl text-ink">{tile.value}</p>
            </div>
          ))}
        </div>
        {top.length > 0 && (
          <div className="border border-t-0 border-line bg-surface px-6 py-5">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {t('stats.topProducts')}
            </p>
            <ul className="mt-2 space-y-1">
              {top.map((p) => (
                <li key={p.productId} className="flex items-baseline justify-between text-sm">
                  <span className="text-ink">{p.name[locale] ?? p.name.en ?? p.productId}</span>
                  <span className="text-muted">{t('stats.sold', { count: p.qty })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

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
