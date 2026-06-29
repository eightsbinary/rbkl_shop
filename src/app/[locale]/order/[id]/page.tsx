import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PaymentPanel } from '@/components/order/PaymentPanel';
import { ShippingTimeline } from '@/components/order/ShippingTimeline';
import type { Locale } from '@/i18n/routing';
import { getOrderForGuest } from '@/server/queries/orders';
import { getPaymentSettings } from '@/server/queries/payment-settings';

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale, id } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);
  if (!token) notFound();
  const data = await getOrderForGuest(id, token);
  if (!data) notFound();

  const tr = await getTranslations('order');
  const tp = await getTranslations('preorder');
  const { order, items } = data;

  const settings =
    order.status === 'awaiting_payment' || order.status === 'awaiting_verification'
      ? await getPaymentSettings()
      : null;

  const address = order.shipping_address as {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };

  return (
    <article className="container mx-auto max-w-3xl px-6 py-16 space-y-12">
      {settings && (
        <PaymentPanel
          orderId={order.id}
          token={token}
          locale={locale}
          amountThb={order.total_thb}
          status={order.status}
          qrUrl={settings.qrUrl}
          accountLabel={settings.accountLabel}
          instructions={settings.instructions}
        />
      )}

      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{tr('title')}</p>
        <h1 className="font-serif text-3xl text-ink">#{order.number}</h1>
        {order.status === 'paid' && <p className="text-ink-soft">{tr('thankYou')}</p>}
      </header>

      <section className="grid gap-12 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="font-serif text-xl text-ink">{tr('placed')}</h2>
          <ShippingTimeline order={order} />
          {order.ship_status === 'awaiting_stock' && (
            <p className="text-sm text-ink-soft">{tp('note')}</p>
          )}
          {order.tracking_number && (
            <p className="text-sm">
              <span className="text-muted">{tr('trackingLabel')}: </span>
              {order.tracking_url ? (
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-rose-deep underline"
                >
                  {order.tracking_number}
                </a>
              ) : (
                <span className="text-ink">{order.tracking_number}</span>
              )}
            </p>
          )}
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted text-xs uppercase tracking-[0.15em]">{tr('items')}</p>
            <ul className="mt-2 space-y-2">
              {items.map((it) => {
                const snap = it.product_snapshot as { name?: { th?: string; en?: string } };
                const name = snap?.name?.[locale] ?? snap?.name?.en ?? it.id;
                return (
                  <li key={it.id} className="flex items-start justify-between gap-2">
                    <span className="text-ink">
                      {name} × {it.qty}
                      {it.is_preorder && (
                        <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-muted">
                          {tp('badge')}
                        </span>
                      )}
                    </span>
                    <span className="text-ink-soft">฿{it.line_total_thb.toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-1 border-t border-line pt-3">
            <Row label="Subtotal" value={order.subtotal_thb} />
            {order.discount_thb > 0 && <Row label="Discount" value={-order.discount_thb} />}
            <Row label="Shipping" value={order.shipping_thb} />
            <div className="flex justify-between border-t border-line pt-2">
              <span className="font-medium text-ink">Total</span>
              <span className="font-serif text-lg text-ink">
                ฿{order.total_thb.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="space-y-1 border-t border-line pt-3 text-ink-soft">
            <p className="font-medium text-ink">Ship to</p>
            <p>{address.fullName}</p>
            <p>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
            </p>
            <p>
              {address.city} {address.postalCode}
            </p>
            <p>{address.country}</p>
          </div>

          <Link
            href={`/${locale}/order/${order.id}/receipt?t=${token}`}
            className="inline-block text-rose-deep hover:underline"
          >
            {tr('receiptLink')} →
          </Link>
        </div>
      </section>
    </article>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="text-ink">
        {value < 0 ? '−' : ''}฿{Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}
