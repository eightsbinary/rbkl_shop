'use client';

import { useTranslations } from 'next-intl';
import type { OrderStatus, ShipStatus } from '@/server/queries/admin-orders';

const orderTone: Record<OrderStatus, string> = {
  awaiting_payment: 'bg-warn/15 text-warn',
  paid: 'bg-success/15 text-success',
  failed: 'bg-error/15 text-error',
  cancelled: 'bg-muted/15 text-muted',
  refunded: 'bg-muted/15 text-muted',
};

const shipTone: Record<ShipStatus, string> = {
  pending: 'bg-muted/15 text-muted',
  preparing: 'bg-warn/15 text-warn',
  shipped: 'bg-rose-soft text-rose-deep',
  delivered: 'bg-success/15 text-success',
};

function Pill({ tone, label }: { tone: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const t = useTranslations('admin.orders');
  const labels: Record<OrderStatus, string> = {
    awaiting_payment: t('orderStatus.awaiting_payment'),
    paid: t('orderStatus.paid'),
    failed: t('orderStatus.failed'),
    cancelled: t('orderStatus.cancelled'),
    refunded: t('orderStatus.refunded'),
  };
  return <Pill tone={orderTone[status]} label={labels[status]} />;
}

export function ShipStatusPill({ status }: { status: ShipStatus }) {
  const t = useTranslations('admin.orders');
  const labels: Record<ShipStatus, string> = {
    pending: t('shipStatus.pending'),
    preparing: t('shipStatus.preparing'),
    shipped: t('shipStatus.shipped'),
    delivered: t('shipStatus.delivered'),
  };
  return <Pill tone={shipTone[status]} label={labels[status]} />;
}
