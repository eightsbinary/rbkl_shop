'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CartLineItem } from '@/components/cart/CartLineItem';
import { OrderSummary } from '@/components/cart/OrderSummary';
import { useCartPreview } from '@/lib/use-cart-preview';

export default function CartPage() {
  const t = useTranslations('cart');
  const locale = useLocale() as 'th' | 'en';
  const { lines, preview, subtotal, count, setQty, remove } = useCartPreview();

  return (
    <section className="container mx-auto px-6 py-16 lg:px-16">
      <header className="space-y-2 pb-12 text-center">
        <h1 className="font-serif text-4xl text-ink lg:text-5xl">{t('pageTitle')}</h1>
        {lines.length > 0 && <p className="text-sm text-muted">{t('itemsCount', { count })}</p>}
      </header>

      {lines.length === 0 ? (
        <div className="space-y-4 text-center">
          <p className="text-muted">{t('empty')}</p>
          <Link
            href={`/${locale}/shop`}
            className="inline-block text-xs uppercase tracking-[0.12em] text-ink underline-offset-4 hover:underline"
          >
            {t('continueShopping')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-12 lg:grid-cols-[1fr_368px]">
          <div className="divide-y divide-line border-t border-line">
            {lines.map((l) => (
              <CartLineItem
                key={l.variantId}
                line={l}
                preview={preview.find((p) => p.variantId === l.variantId)}
                locale={locale}
                setQty={setQty}
                remove={remove}
              />
            ))}
          </div>
          <div className="lg:sticky lg:top-24 lg:self-start">
            <OrderSummary subtotal={subtotal} locale={locale} />
          </div>
        </div>
      )}
    </section>
  );
}
