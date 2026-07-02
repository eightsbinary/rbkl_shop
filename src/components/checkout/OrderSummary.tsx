'use client';

import { useTranslations } from 'next-intl';
import type { CartPreviewLine } from '@/server/queries/cart';

export interface SummaryNumbers {
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}

export function OrderSummary({
  lines,
  preview,
  numbers,
}: {
  lines: { variantId: string; qty: number }[];
  preview: CartPreviewLine[];
  numbers: SummaryNumbers;
}) {
  const t = useTranslations('checkout');

  return (
    <aside className="rounded-lg border border-line bg-paper p-6 space-y-4">
      <h2 className="font-serif text-xl text-ink">{t('summary')}</h2>
      <ul className="space-y-3 text-sm">
        {lines.map((l) => {
          const p = preview.find((x) => x.variantId === l.variantId);
          const name = p?.productName.en ?? p?.productName.th ?? l.variantId;
          return (
            <li key={l.variantId} className="flex items-start justify-between gap-2">
              <span className="text-ink-soft">
                {name} × {l.qty}
              </span>
              <span className="text-ink">฿{((p?.unitPriceThb ?? 0) * l.qty).toLocaleString()}</span>
            </li>
          );
        })}
      </ul>
      <div className="space-y-2 border-t border-line pt-4 text-sm">
        <Row label={t('subtotal')} value={numbers.subtotal} />
        {numbers.discount > 0 && <Row label={t('discount')} value={-numbers.discount} />}
        <Row label={t('shippingCost')} value={numbers.shipping} />
        <div className="flex justify-between border-t border-line pt-2 font-medium">
          <span className="text-ink">{t('total')}</span>
          <span className="font-serif text-xl text-ink">฿{numbers.total.toLocaleString()}</span>
        </div>
      </div>
    </aside>
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
