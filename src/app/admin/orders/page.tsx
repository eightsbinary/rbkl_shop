import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminSearchForm } from '@/components/admin/AdminSearchForm';
import { OrdersTable } from '@/components/admin/OrdersTable';
import {
  listAdminOrders,
  ORDER_STATUSES,
  type OrderStatus,
  type ShipStatus,
} from '@/server/queries/admin-orders';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ship?: string; q?: string }>;
}) {
  const { status, ship, q } = await searchParams;
  const active = ORDER_STATUSES.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;
  const activeShip: ShipStatus | undefined =
    ship === 'awaiting_stock' ? 'awaiting_stock' : undefined;
  const search = q?.trim() || undefined;
  const orders = await listAdminOrders(activeShip ? undefined : active, activeShip, search);

  const t = await getTranslations('admin.orders');

  const orderStatusLabels: Record<OrderStatus, string> = {
    awaiting_payment: t('orderStatus.awaiting_payment'),
    awaiting_verification: t('orderStatus.awaiting_verification'),
    paid: t('orderStatus.paid'),
    failed: t('orderStatus.failed'),
    cancelled: t('orderStatus.cancelled'),
    refunded: t('orderStatus.refunded'),
  };

  const withSearch = (href: string) =>
    search ? `${href}${href.includes('?') ? '&' : '?'}q=${encodeURIComponent(search)}` : href;

  const filters: {
    key: OrderStatus | 'all' | 'ship_awaiting_stock';
    label: string;
    href: string;
  }[] = [
    { key: 'all', label: t('filterAll'), href: withSearch('/admin/orders') },
    ...ORDER_STATUSES.map((s) => ({
      key: s as OrderStatus | 'all' | 'ship_awaiting_stock',
      label: orderStatusLabels[s],
      href: withSearch(`/admin/orders?status=${s}`),
    })),
    {
      key: 'ship_awaiting_stock',
      label: t('filterAwaitingStock'),
      href: withSearch('/admin/orders?ship=awaiting_stock'),
    },
  ];

  // The filter (without q) the search form submits into and the ✕ clears back to.
  const filterHref = activeShip
    ? '/admin/orders?ship=awaiting_stock'
    : active
      ? `/admin/orders?status=${active}`
      : '/admin/orders';

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>

      <nav className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const isActive =
            f.key === 'all'
              ? !active && !activeShip
              : f.key === 'ship_awaiting_stock'
                ? !!activeShip
                : f.key === active && !activeShip;
          return (
            <Link
              key={f.key}
              href={f.href}
              className={`rounded-full px-3.5 py-1.5 text-xs uppercase tracking-[0.1em] transition-all duration-150 ease-out-soft active:scale-95 ${
                isActive
                  ? 'bg-ink text-paper'
                  : 'border border-line text-ink-soft hover:border-ink hover:text-ink'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <AdminSearchForm
        action="/admin/orders"
        placeholder={t('searchPlaceholder')}
        search={search}
        clearHref={filterHref}
      >
        {activeShip ? (
          <input type="hidden" name="ship" value="awaiting_stock" />
        ) : (
          active && <input type="hidden" name="status" value={active} />
        )}
      </AdminSearchForm>

      <OrdersTable orders={orders} />
    </div>
  );
}
