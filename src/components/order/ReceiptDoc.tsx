import { useTranslations } from 'next-intl';
import type { Database } from '@/db/types.gen';

type Order = Database['public']['Tables']['orders']['Row'];
type Item = Database['public']['Tables']['order_items']['Row'];

export function ReceiptDoc({
  order,
  items,
  locale,
}: {
  order: Order;
  items: Item[];
  locale: 'th' | 'en';
}) {
  const t = useTranslations('receipt');
  const address = order.shipping_address as {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };

  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-ink print:p-0 print:max-w-none">
      <header className="border-b border-line pb-6 mb-6 flex items-start justify-between">
        <div>
          <p className="font-serif text-2xl text-ink">{t('shopName')}</p>
          <p className="text-xs text-muted">made slowly, shipped warmly</p>
        </div>
        <div className="text-right text-sm text-ink-soft">
          <p>
            {t('orderNumber')} #{order.number}
          </p>
          <p>
            {t('date')}{' '}
            {new Date(order.created_at).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8 mb-8 text-sm">
        <div className="space-y-1">
          <p className="font-medium text-ink">{t('shipTo')}</p>
          <p className="text-ink-soft">{address.fullName}</p>
          <p className="text-ink-soft">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ''}
          </p>
          <p className="text-ink-soft">
            {address.city} {address.postalCode}
          </p>
          <p className="text-ink-soft">{address.country}</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="font-medium text-ink">{t('paymentMethod')}</p>
          <p className="text-ink-soft">
            {order.payment_provider} / {order.payment_method ?? '—'}
          </p>
        </div>
      </section>

      <table className="w-full text-sm mb-8">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-2 font-medium">Item</th>
            <th className="py-2 font-medium text-right">Qty</th>
            <th className="py-2 font-medium text-right">Unit</th>
            <th className="py-2 font-medium text-right">Line</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const snap = it.product_snapshot as {
              name?: { th?: string; en?: string };
              optionValues?: Record<string, string>;
            };
            const name = snap?.name?.[locale] ?? snap?.name?.en ?? it.id;
            const opts = snap?.optionValues ? Object.values(snap.optionValues).join(' / ') : '';
            return (
              <tr key={it.id} className="border-b border-line">
                <td className="py-3">
                  <p className="text-ink">{name}</p>
                  {opts && <p className="text-xs text-muted">{opts}</p>}
                </td>
                <td className="py-3 text-right text-ink-soft">{it.qty}</td>
                <td className="py-3 text-right text-ink-soft">
                  ฿{it.unit_price_thb.toLocaleString()}
                </td>
                <td className="py-3 text-right text-ink">฿{it.line_total_thb.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <Row label={t('subtotal')} value={order.subtotal_thb} />
        {order.discount_thb > 0 && <Row label={t('discount')} value={-order.discount_thb} />}
        <Row label={t('shipping')} value={order.shipping_thb} />
        <div className="flex justify-between border-t border-line pt-2 mt-2 text-base">
          <span className="font-medium text-ink">{t('total')}</span>
          <span className="font-serif text-xl text-ink">฿{order.total_thb.toLocaleString()}</span>
        </div>
      </section>

      <footer className="mt-12 border-t border-line pt-6 text-center text-sm text-muted">
        {t('thankYou')} ✿
      </footer>
    </div>
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
