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
      {label.replace(/_/g, ' ')}
    </span>
  );
}

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <Pill tone={orderTone[status]} label={status} />;
}

export function ShipStatusPill({ status }: { status: ShipStatus }) {
  return <Pill tone={shipTone[status]} label={status} />;
}
