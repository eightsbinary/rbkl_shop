'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

export function OrderSummary({ subtotal, locale }: { subtotal: number; locale: 'th' | 'en' }) {
  const t = useTranslations('cart');
  const money = `฿${subtotal.toLocaleString()}`;
  return (
    <div className="border border-line bg-surface p-8 shadow-sm">
      <h2 className="font-serif text-2xl text-ink">{t('orderSummary')}</h2>
      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{t('subtotal')}</dt>
          <dd className="text-ink">{money}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">{t('shipping')}</dt>
          <dd className="text-muted">{t('shippingNote')}</dd>
        </div>
      </dl>
      <div className="mt-4 flex justify-between border-t border-line pt-4 text-base font-medium text-ink">
        <span>{t('total')}</span>
        <span>{money}</span>
      </div>
      <Link href={`/${locale}/checkout`}>
        <Button variant="solid" size="lg" className="mt-6 w-full">
          {t('checkoutCta')}
        </Button>
      </Link>
      <p className="mt-4 text-center text-xs text-muted">🔒 {t('secureCheckout')}</p>
    </div>
  );
}
