'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useCart } from '@/lib/cart-store';
import type { CartPreviewLine } from '@/server/queries/cart';

export function CartContents() {
  const t = useTranslations('cart');
  const locale = useLocale();
  const lines = useCart((s) => s.lines);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const setOpen = useCart((s) => s.setOpen);
  const [preview, setPreview] = useState<CartPreviewLine[]>([]);

  useEffect(() => {
    if (lines.length === 0) {
      setPreview([]);
      return;
    }
    const ids = lines.map((l) => l.variantId);
    fetch('/api/cart/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((r) => r.json() as Promise<CartPreviewLine[]>)
      .then(setPreview)
      .catch(() => setPreview([]));
  }, [lines]);

  if (lines.length === 0) {
    return <p className="text-muted">{t('empty')}</p>;
  }

  const subtotal = lines.reduce((acc, l) => {
    const p = preview.find((x) => x.variantId === l.variantId);
    return acc + (p?.unitPriceThb ?? 0) * l.qty;
  }, 0);

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 space-y-4 overflow-y-auto">
        {lines.map((l) => {
          const p = preview.find((x) => x.variantId === l.variantId);
          const name =
            p?.productName[locale as 'th' | 'en'] ??
            p?.productName.en ??
            p?.productName.th ??
            l.variantId;
          const optDesc = p ? Object.values(p.optionValues).join(' / ') : '';
          return (
            <li key={l.variantId} className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-ink">{name}</p>
                <p className="text-xs text-muted">{optDesc}</p>
                {p && <p className="text-xs text-muted">฿{p.unitPriceThb.toLocaleString()}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQty(l.variantId, l.qty - 1)}
                  className="h-8 w-8 rounded border border-line"
                  aria-label="decrease"
                >
                  −
                </button>
                <span className="w-6 text-center">{l.qty}</span>
                <button
                  type="button"
                  onClick={() => setQty(l.variantId, l.qty + 1)}
                  className="h-8 w-8 rounded border border-line"
                  aria-label="increase"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => remove(l.variantId)}
                  className="text-muted hover:text-error text-sm"
                  aria-label="remove"
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted">{t('subtotal')}</span>
          <span className="text-ink">฿{subtotal.toLocaleString()}</span>
        </div>
        <Link href={`/${locale}/checkout`} onClick={() => setOpen(false)}>
          <Button className="w-full">{t('checkout')}</Button>
        </Link>
      </div>
    </div>
  );
}
