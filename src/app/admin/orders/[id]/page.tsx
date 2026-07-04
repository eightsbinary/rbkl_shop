import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CancelOrderButton } from '@/components/admin/CancelOrderButton';
import { EditTracking } from '@/components/admin/EditTracking';
import { ShipOrderForm } from '@/components/admin/ShipOrderForm';
import { SlipReview } from '@/components/admin/SlipReview';
import { StartPreparingButton } from '@/components/admin/StartPreparingButton';
import { OrderStatusPill, ShipStatusPill } from '@/components/admin/StatusPill';
import { getAdminOrder } from '@/server/queries/admin-orders';
import { getOrderSlipReview } from '@/server/queries/admin-payment';

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

  const t = await getTranslations('admin.orders');

  const slip = order.status === 'awaiting_verification' ? await getOrderSlipReview(order.id) : null;

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
      <div className="space-y-5">
        <Link
          href="/admin/orders"
          className="inline-block text-sm text-muted transition-colors duration-150 ease-out-soft hover:text-ink"
        >
          {t('backLink')}
        </Link>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-serif text-3xl text-ink">#{order.number}</h1>
            <OrderStatusPill status={order.status} />
            <ShipStatusPill status={order.ship_status} />
          </div>
          <p className="text-sm text-muted">
            {order.customer_email} · {t('placed')} {dateFmt.format(new Date(order.created_at))}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-6">
          <div className="border border-line bg-surface p-6">
            <h2 className="font-serif text-lg text-ink">{t('sectionItems')}</h2>
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
              <Row label={t('subtotal')} value={order.subtotal_thb} />
              {order.discount_thb > 0 && <Row label={t('discount')} value={-order.discount_thb} />}
              <Row label={t('shipping')} value={order.shipping_thb} />
              <div className="flex justify-between border-t border-line pt-2">
                <dt className="font-medium text-ink">{t('total')}</dt>
                <dd className="font-serif text-lg text-ink">฿{order.total_thb.toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-line bg-surface p-6 text-sm text-ink-soft">
            <h2 className="font-serif text-lg text-ink">{t('sectionShipTo')}</h2>
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
          {order.status === 'awaiting_verification' ? (
            <div className="border border-line bg-surface p-6">
              <h2 className="font-serif text-lg text-ink">{t('paymentSection')}</h2>
              <SlipReview orderId={order.id} imageUrl={slip?.imageUrl ?? null} />
            </div>
          ) : order.status === 'awaiting_payment' ? (
            <div className="border border-line bg-surface p-6">
              <h2 className="font-serif text-lg text-ink">{t('paymentSection')}</h2>
              <p className="mt-3 text-sm text-muted">{t('awaitingPaymentNote')}</p>
            </div>
          ) : null}

          <div className="border border-line bg-surface p-6">
            <h2 className="font-serif text-lg text-ink">{t('sectionFulfillment')}</h2>
            {order.ship_status === 'shipped' || order.ship_status === 'delivered' ? (
              <div className="mt-3 space-y-1 text-sm text-ink-soft">
                <p>
                  {t('shippedVia')}{' '}
                  <span className="text-ink">{order.tracking_carrier ?? t('carrierFallback')}</span>
                </p>
                <p>
                  {t('trackingLabel')}{' '}
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
                <div className="pt-2">
                  <EditTracking
                    orderId={order.id}
                    initial={{
                      carrier: order.tracking_carrier ?? undefined,
                      trackingNumber: order.tracking_number ?? undefined,
                      eta: order.estimated_delivery_date ?? undefined,
                      notes: order.notes_to_buyer ?? undefined,
                    }}
                  />
                </div>
              </div>
            ) : order.status === 'paid' ? (
              <div className="mt-4 space-y-6">
                {order.ship_status === 'awaiting_stock' && (
                  <StartPreparingButton orderId={order.id} />
                )}
                <ShipOrderForm orderId={order.id} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">{t('notPaid')}</p>
            )}
          </div>

          <div className="border border-line bg-surface p-6">
            <h2 className="font-serif text-lg text-ink">{t('sectionActivity')}</h2>
            <ol className="mt-3 space-y-3 text-sm">
              {events.length === 0 && <li className="text-muted">{t('noEvents')}</li>}
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

          {(order.status === 'awaiting_payment' || order.status === 'awaiting_verification') && (
            <div className="border border-error/40 bg-surface p-6">
              <h2 className="font-serif text-lg text-error">{t('dangerZone')}</h2>
              <div className="mt-3">
                <CancelOrderButton orderId={order.id} />
              </div>
            </div>
          )}
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
