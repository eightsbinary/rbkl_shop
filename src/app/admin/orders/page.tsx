import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
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
  searchParams: Promise<{ status?: string; ship?: string }>;
}) {
  const { status, ship } = await searchParams;
  const active = ORDER_STATUSES.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;
  const activeShip: ShipStatus | undefined =
    ship === 'awaiting_stock' ? 'awaiting_stock' : undefined;
  const orders = await listAdminOrders(activeShip ? undefined : active, activeShip);

  const t = await getTranslations('admin.orders');

  const orderStatusLabels: Record<OrderStatus, string> = {
    awaiting_payment: t('orderStatus.awaiting_payment'),
    awaiting_verification: t('orderStatus.awaiting_verification'),
    paid: t('orderStatus.paid'),
    failed: t('orderStatus.failed'),
    cancelled: t('orderStatus.cancelled'),
    refunded: t('orderStatus.refunded'),
  };

  const filters: {
    key: OrderStatus | 'all' | 'ship_awaiting_stock';
    label: string;
    href: string;
  }[] = [
    { key: 'all', label: t('filterAll'), href: '/admin/orders' },
    ...ORDER_STATUSES.map((s) => ({
      key: s as OrderStatus | 'all' | 'ship_awaiting_stock',
      label: orderStatusLabels[s],
      href: `/admin/orders?status=${s}`,
    })),
    {
      key: 'ship_awaiting_stock',
      label: t('filterAwaitingStock'),
      href: '/admin/orders?ship=awaiting_stock',
    },
  ];

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
              className={`rounded-full px-3 py-1 text-sm capitalize transition-all duration-150 ease-out-soft active:scale-95 ${
                isActive
                  ? 'bg-ink text-paper'
                  : 'border border-line text-ink-soft hover:border-rose hover:text-ink'
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <OrdersTable orders={orders} />
    </div>
  );
}
