'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartLineItem } from '@/components/cart/CartLineItem';
import { Button } from '@/components/ui/Button';
import { useCartPreview } from '@/lib/use-cart-preview';

export function CartContents() {
  const t = useTranslations('cart');
  const locale = useLocale() as 'th' | 'en';
  const { lines, preview, subtotal, setQty, remove, setOpen } = useCartPreview();

  if (lines.length === 0) {
    return <p className="text-muted">{t('empty')}</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <ul className="flex-1 divide-y divide-line overflow-y-auto">
        {lines.map((l) => (
          <li key={l.variantId}>
            <CartLineItem
              line={l}
              preview={preview.find((p) => p.variantId === l.variantId)}
              locale={locale}
              setQty={setQty}
              remove={remove}
              compact
            />
          </li>
        ))}
      </ul>
      <div className="space-y-3 border-t border-line pt-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted">{t('subtotal')}</span>
          <span className="text-ink">฿{subtotal.toLocaleString()}</span>
        </div>
        <Link href={`/${locale}/checkout`} onClick={() => setOpen(false)}>
          <Button variant="solid" className="w-full">
            {t('checkout')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
