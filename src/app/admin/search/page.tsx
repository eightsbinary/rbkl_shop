import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminSearchForm } from '@/components/admin/AdminSearchForm';
import { OrderStatusPill } from '@/components/admin/StatusPill';
import { listAdminDiscounts } from '@/server/queries/admin-discounts';
import { listNewsletterSubscribers } from '@/server/queries/admin-newsletter';
import { listAdminOrders } from '@/server/queries/admin-orders';
import { listAdminProducts } from '@/server/queries/admin-products';
import { listWaitlistGroups } from '@/server/queries/admin-waitlists';

const PER_SECTION = 5;

/** Global admin search: one query fanned out across all sections, top hits per
 *  section with a "view all" link into the section's own filtered page. */
export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() || undefined;
  const t = await getTranslations('admin.search');
  const tc = await getTranslations('admin.common');

  const [orders, products, subscribers, discounts, waitlists] = search
    ? await Promise.all([
        listAdminOrders(undefined, undefined, search),
        listAdminProducts(search),
        listNewsletterSubscribers(search),
        listAdminDiscounts(search),
        listWaitlistGroups(search),
      ])
    : [[], [], [], [], []];

  const sections = [
    {
      key: 'orders',
      href: '/admin/orders',
      total: orders.length,
      rows: orders.slice(0, PER_SECTION).map((o) => ({
        id: o.id,
        href: `/admin/orders/${o.id}`,
        primary: `#${o.number}`,
        secondary: o.customer_email,
        pill: <OrderStatusPill status={o.status} />,
      })),
    },
    {
      key: 'products',
      href: '/admin/products',
      total: products.length,
      rows: products.slice(0, PER_SECTION).map((p) => {
        const name = p.name as { en?: string; th?: string };
        return {
          id: p.id,
          href: `/admin/products/${p.id}/edit`,
          primary: name.en ?? name.th ?? p.slug,
          secondary: p.slug,
          pill: null,
        };
      }),
    },
    {
      key: 'subscribers',
      href: '/admin/newsletter',
      total: subscribers.length,
      rows: subscribers.slice(0, PER_SECTION).map((s) => ({
        id: s.id,
        href: '/admin/newsletter',
        primary: s.email,
        secondary: s.status,
        pill: null,
      })),
    },
    {
      key: 'discounts',
      href: '/admin/discounts',
      total: discounts.length,
      rows: discounts.slice(0, PER_SECTION).map((d) => ({
        id: d.id,
        href: `/admin/discounts/${d.id}/edit`,
        primary: d.code,
        secondary: d.kind === 'percent' ? `${d.value}%` : `฿${d.value.toLocaleString()}`,
        pill: null,
      })),
    },
    {
      key: 'waitlists',
      href: '/admin/waitlists',
      total: waitlists.length,
      rows: waitlists.slice(0, PER_SECTION).map((w) => ({
        id: w.variantId,
        href: '/admin/waitlists',
        primary: w.productName,
        secondary: `${w.optionLabel} · ${w.count}`,
        pill: null,
      })),
    },
  ] as const;

  const anyHit = sections.some((s) => s.total > 0);

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>

      <AdminSearchForm
        action="/admin/search"
        placeholder={t('placeholder')}
        search={search}
        clearHref="/admin/search"
      />

      {search && !anyHit && <p className="text-muted">{t('empty', { q: search })}</p>}

      {sections.map((s) =>
        s.total === 0 ? null : (
          <section key={s.key} className="border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-xs uppercase tracking-[0.14em] text-muted">
                {t(`sections.${s.key}`)} · {s.total}
              </h2>
              <Link
                href={`${s.href}?q=${encodeURIComponent(search ?? '')}`}
                className="text-xs text-ink underline-offset-2 hover:underline"
              >
                {t('viewAll')}
              </Link>
            </div>
            <ul>
              {s.rows.map((row) => (
                <li key={row.id} className="border-b border-line last:border-0">
                  <Link
                    href={row.href}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-field"
                  >
                    <span className="text-ink">{row.primary}</span>
                    <span className="flex items-center gap-3 text-muted">
                      {row.secondary}
                      {row.pill}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ),
      )}

      {!search && <p className="text-muted">{tc('searchCta')} ↑</p>}
    </div>
  );
}
