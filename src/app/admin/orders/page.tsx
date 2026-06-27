import Link from 'next/link';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { listAdminOrders, ORDER_STATUSES, type OrderStatus } from '@/server/queries/admin-orders';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = ORDER_STATUSES.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;
  const orders = await listAdminOrders(active);

  const filters: { key: OrderStatus | 'all'; label: string; href: string }[] = [
    { key: 'all', label: 'All', href: '/admin/orders' },
    ...ORDER_STATUSES.map((s) => ({
      key: s,
      label: s.replace(/_/g, ' '),
      href: `/admin/orders?status=${s}`,
    })),
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">Orders</h1>

      <nav className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const isActive = f.key === 'all' ? !active : f.key === active;
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
