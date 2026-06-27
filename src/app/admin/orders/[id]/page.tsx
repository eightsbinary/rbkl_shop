import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShipOrderForm } from '@/components/admin/ShipOrderForm';
import { OrderStatusPill, ShipStatusPill } from '@/components/admin/StatusPill';
import { getAdminOrder } from '@/server/queries/admin-orders';

const dateFmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAdminOrder(id);
  if (!detail) notFound();
  const { order, items, events } = detail;

  const address = order.shipping_address as {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/admin/orders"
          className="text-sm text-muted transition-colors duration-150 ease-out-soft hover:text-ink"
        >
          ← Orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl text-ink">#{order.number}</h1>
          <OrderStatusPill status={order.status} />
          <ShipStatusPill status={order.ship_status} />
        </div>
        <p className="text-sm text-muted">
          {order.customer_email} · placed {dateFmt.format(new Date(order.created_at))}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-6">
          <div className="rounded-lg border border-line bg-paper p-6">
            <h2 className="font-serif text-lg text-ink">Items</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {items.map((it) => {
                const snap = it.product_snapshot as {
                  name?: { th?: string; en?: string };
                  optionValues?: Record<string, string>;
                } | null;
                const name = snap?.name?.en ?? snap?.name?.th ?? it.id;
                const opts = snap?.optionValues ? Object.values(snap.optionValues).join(' / ') : '';
                return (
                  <li key={it.id} className="flex items-start justify-between gap-2">
                    <span className="text-ink">
                      {name}
                      {opts && <span className="text-muted"> · {opts}</span>}
                      <span className="text-muted"> × {it.qty}</span>
                    </span>
                    <span className="text-ink-soft">฿{it.line_total_thb.toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
              <Row label="Subtotal" value={order.subtotal_thb} />
              {order.discount_thb > 0 && <Row label="Discount" value={-order.discount_thb} />}
              <Row label="Shipping" value={order.shipping_thb} />
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="font-serif text-lg text-ink">฿{order.total_thb.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-line bg-paper p-6 text-sm text-ink-soft">
            <h2 className="font-serif text-lg text-ink">Ship to</h2>
            <p className="mt-3 text-ink">{address.fullName}</p>
            <p>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
            </p>
            <p>
              {address.city} {address.postalCode}
            </p>
            <p>{address.country}</p>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-lg border border-line bg-paper p-6">
            <h2 className="font-serif text-lg text-ink">Fulfillment</h2>
            {order.ship_status === 'shipped' || order.ship_status === 'delivered' ? (
              <div className="mt-3 space-y-1 text-sm text-ink-soft">
                <p>
                  Shipped via{' '}
                  <span className="text-ink">{order.tracking_carrier ?? 'carrier'}</span>
                </p>
                <p>
                  Tracking:{' '}
                  {order.tracking_url ? (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-rose-deep hover:underline"
                    >
                      {order.tracking_number}
                    </a>
                  ) : (
                    <span className="text-ink">{order.tracking_number}</span>
                  )}
                </p>
                {order.shipped_at && (
                  <p className="text-muted">{dateFmt.format(new Date(order.shipped_at))}</p>
                )}
              </div>
            ) : order.status === 'paid' ? (
              <div className="mt-4">
                <ShipOrderForm orderId={order.id} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">Order isn't paid yet — nothing to ship.</p>
            )}
          </div>

          <div className="rounded-lg border border-line bg-paper p-6">
            <h2 className="font-serif text-lg text-ink">Activity</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {events.length === 0 && <li className="text-muted">No events.</li>}
              {events.map((ev) => (
                <li key={ev.id} className="flex items-start justify-between gap-3">
                  <span className="text-ink">{ev.type.replace(/[._]/g, ' ')}</span>
                  <span className="shrink-0 text-muted">
                    {ev.actor} · {dateFmt.format(new Date(ev.created_at))}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="text-ink">
        {value < 0 ? '−' : ''}฿{Math.abs(value).toLocaleString()}
      </dd>
    </div>
  );
}
