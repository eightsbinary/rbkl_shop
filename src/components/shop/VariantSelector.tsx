'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AddToCartButton } from '@/components/cart/AddToCartButton';
import { WaitlistButton } from '@/components/shop/WaitlistButton';
import { Label } from '@/components/ui/Label';
import type { Database } from '@/db/types.gen';

type Variant = Database['public']['Tables']['variants']['Row'];

export function VariantSelector({
  options,
  variants,
  basePriceThb,
}: {
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
    <div className="space-y-6">
      {options.map((opt) => (
        <div key={opt.name} className="space-y-2">
          <Label>{t(opt.name === 'size' ? 'size' : 'color')}</Label>
          <div className="flex flex-wrap gap-2">
            {opt.values.map((v) => {
              const isSelected = selection[opt.name] === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSelection({ ...selection, [opt.name]: v })}
                  className={`h-11 min-w-11 rounded-md border px-3 text-sm transition-all duration-150 ease-out-soft active:scale-95 ${
                    isSelected
                      ? 'border-ink bg-ink text-paper shadow-sm'
                      : 'border-line bg-paper text-ink hover:-translate-y-px hover:border-rose'
                  }`}
                >
                  {v}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pt-2">
        <p className="font-serif text-2xl text-ink">฿{price.toLocaleString()}</p>
      </div>

      {ready && !inStock ? (
        <WaitlistButton variantId={matched?.id ?? null} />
      ) : (
        <AddToCartButton variantId={matched?.id ?? null} ready={ready} outOfStock={false} />
      )}
    </div>
  );
}
