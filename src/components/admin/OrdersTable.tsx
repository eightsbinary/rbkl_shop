'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { AdminOrderRow } from '@/server/queries/admin-orders';
import { OrderStatusPill, ShipStatusPill } from './StatusPill';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function OrdersTable({ orders }: { orders: AdminOrderRow[] }) {
  const t = useTranslations('admin.orders');
  const tc = useTranslations('admin.common');

  if (orders.length === 0) {
    return <p className="text-muted">{t('empty')}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-muted">
          <tr>
            <th className="px-4 py-3 font-medium">{t('colOrder')}</th>
            <th className="px-4 py-3 font-medium">{t('colCustomer')}</th>
            <th className="px-4 py-3 font-medium">{tc('status')}</th>
            <th className="px-4 py-3 font-medium">{t('colShipping')}</th>
            <th className="px-4 py-3 font-medium">{t('colTotal')}</th>
            <th className="px-4 py-3 font-medium">{t('colPlaced')}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.id}
              className="border-b border-line transition-colors duration-150 ease-out-soft last:border-0 hover:bg-paper-warm"
            >
              <td className="px-4 py-3 font-medium text-ink">{o.number}</td>
              <td className="px-4 py-3 text-ink-soft">{o.customer_email}</td>
              <td className="px-4 py-3">
                <OrderStatusPill status={o.status} />
              </td>
              <td className="px-4 py-3">
                <ShipStatusPill status={o.ship_status} />
              </td>
              <td className="px-4 py-3 text-ink-soft">฿{o.total_thb.toLocaleString()}</td>
              <td className="px-4 py-3 text-muted">{dateFmt.format(new Date(o.created_at))}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="text-rose-deep transition-colors duration-150 ease-out-soft hover:text-ink hover:underline"
                >
                  {tc('viewLink')}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
