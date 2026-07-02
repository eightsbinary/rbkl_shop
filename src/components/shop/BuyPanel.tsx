'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { Accordion } from '@/components/shop/Accordion';
import { WaitlistButton } from '@/components/shop/WaitlistButton';
import { Button } from '@/components/ui/Button';
import type { Database } from '@/db/types.gen';
import { preorderActive, preorderCapacity } from '@/domain/preorder';

type Variant = Database['public']['Tables']['variants']['Row'];

export function BuyPanel({
  name,
  description,
  category,
  options,
  variants,
  basePriceThb,
  isPreorder,
  preorderShipDate,
  accordions,
}: {
  name: string;
  description: string;
  category: string | null;
  options: { name: string; values: string[] }[];
  variants: Variant[];
  basePriceThb: number;
  isPreorder: boolean;
  preorderShipDate: string | null;
  /** Admin-editable accordion copy; falls back to i18n when absent. */
  accordions?: {
    detailsTitle: string;
    detailsBody: string;
    shippingTitle: string;
    shippingBody: string;
  };
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
  const tp = useTranslations('preorder');
  const locale = useLocale();
  const preState = matched
    ? {
        isPreorder,
        preorderEnabled: matched.preorder_enabled,
        preorderCap: matched.preorder_cap,
        preorderCount: matched.preorder_count,
        stockAvailable: matched.stock_available,
      }
    : null;
  const canPreorder = preState ? preorderActive(preState) && preorderCapacity(preState) > 0 : false;
  const preorderFull = preState
    ? preorderActive(preState) && preorderCapacity(preState) <= 0
    : false;
  const slotsLeft = preState ? preorderCapacity(preState) : 0;
  const showPreorderBadge = isPreorder || canPreorder || preorderFull;
  const shipDateLabel = preorderShipDate
    ? tp('shipBy', {
        date: new Date(preorderShipDate).toLocaleDateString(locale === 'th' ? 'th-TH' : 'en-GB', {
          month: 'short',
          year: 'numeric',
        }),
      })
    : tp('shipWhenReady');

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
      <div className="flex items-center gap-3 pb-8">
        <p className="text-lg text-muted">฿{price.toLocaleString()}</p>
        {showPreorderBadge && (
          <span className="rounded-full border border-ink px-2.5 py-0.5 text-xs uppercase tracking-[0.12em] text-ink">
            {tp('badge')}
          </span>
        )}
      </div>

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
        {!ready || inStock ? (
          <AddToCartButton variantId={matched?.id ?? null} ready={ready} outOfStock={false} />
        ) : canPreorder ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-soft">{shipDateLabel}</p>
            {Number.isFinite(slotsLeft) && (
              <p className="text-xs uppercase tracking-[0.12em] text-muted">
                {tp('slotsLeft', { n: slotsLeft })}
              </p>
            )}
            <AddToCartButton
              variantId={matched?.id ?? null}
              ready={ready}
              outOfStock={false}
              preorder
            />
          </div>
        ) : preorderFull ? (
          <Button variant="solid" size="lg" className="w-full" disabled>
            {tp('full')}
          </Button>
        ) : (
          <WaitlistButton variantId={matched?.id ?? null} />
        )}
      </div>

      <div className="border-t border-line">
        <Accordion title={accordions?.detailsTitle ?? t('detailsTitle')}>
          {accordions?.detailsBody ?? t('detailsBody')}
        </Accordion>
        <Accordion title={accordions?.shippingTitle ?? t('shippingTitle')}>
          {accordions?.shippingBody ?? t('shippingBody')}
        </Accordion>
      </div>
    </div>
  );
}
