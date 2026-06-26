'use client';

import { useTranslations } from 'next-intl';
import { CartContents } from '@/components/cart/CartContents';

export default function CartPage() {
  const t = useTranslations('cart');
  return (
    <section className="container mx-auto max-w-2xl px-6 py-16 space-y-8">
      <h1 className="font-serif text-4xl text-ink">{t('title')}</h1>
      <CartContents />
    </section>
  );
}
