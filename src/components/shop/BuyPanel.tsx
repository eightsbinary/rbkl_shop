'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { Accordion } from '@/components/shop/Accordion';
import { WaitlistButton } from '@/components/shop/WaitlistButton';
import type { Database } from '@/db/types.gen';

type Variant = Database['public']['Tables']['variants']['Row'];

export function BuyPanel({
  name,
  description,
  category,
  options,
  variants,
  basePriceThb,
}: {
  name: string;
  description: string;
  category: string | null;
  options: { name: string; values: string[] }[];
  variants: Variant[];
  basePriceThb: number;
}) {
  const t = useTranslations('pdp');
  const [selection, setSelection] = useState<Record<string, string>>({});

  const matched = variants.find((v) => {
    const vals = v.option_values as Record<string, string>;
    return options.every((o) => vals[o.name] === selection[o.name]);
  });
  const ready = options.every((o) => selection[o.name]);
  const inStock = !!matched && matched.stock_available > 0;
  const price = matched?.price_thb ?? basePriceThb;

  return (
    <div className="lg:pl-6">
      <nav className="flex flex-wrap gap-2 pb-8 text-xs uppercase tracking-[0.12em] text-muted">
        <span>{t('breadcrumbHome')}</span>
        {category && (
          <>
            <span aria-hidden={true}>—</span>
            <span>{category}</span>
          </>
        )}
      </nav>

      <h1 className="pb-4 font-serif text-4xl leading-tight text-ink">{name}</h1>
      <p className="pb-8 text-lg text-muted">฿{price.toLocaleString()}</p>

      {description && (
        <div className="border-t border-line pb-8 pt-8">
          <p className="whitespace-pre-line text-base leading-relaxed text-ink-soft">
            {description}
          </p>
        </div>
      )}

      <div className="space-y-4 pb-8">
        {options.map((opt) => (
          <div key={opt.name} className="space-y-3">
            <p className="text-xs uppercase tracking-[0.12em] text-ink">
              {t(opt.name === 'size' ? 'size' : 'color')}
            </p>
            <div className="flex flex-wrap gap-3">
              {opt.values.map((v) => {
                const sel = selection[opt.name] === v;
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => setSelection({ ...selection, [opt.name]: v })}
                    className={`border px-6 py-3 text-sm transition-colors ${
                      sel
                        ? 'border-ink text-ink'
                        : 'border-muted text-muted hover:border-ink hover:text-ink'
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="pb-12">
        {ready && !inStock ? (
          <WaitlistButton variantId={matched?.id ?? null} />
        ) : (
          <AddToCartButton variantId={matched?.id ?? null} ready={ready} outOfStock={false} />
        )}
      </div>

      <div className="border-t border-line">
        <Accordion title={t('detailsTitle')}>{t('detailsBody')}</Accordion>
        <Accordion title={t('shippingTitle')}>{t('shippingBody')}</Accordion>
      </div>
    </div>
  );
}
