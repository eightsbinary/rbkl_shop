import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PDP } from '@/components/shop/PDP';
import type { ProductCopyField } from '@/domain/product-copy';
import type { Locale } from '@/i18n/routing';
import { getProductCopy } from '@/server/queries/product-copy';
import { getProductBySlug } from '@/server/queries/products';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [data, copy, t] = await Promise.all([
    getProductBySlug(slug),
    getProductCopy(),
    getTranslations('pdp'),
  ]);
  if (!data) notFound();

  // Admin override for this locale, else the i18n default.
  const v = (field: ProductCopyField) => copy[field]?.[locale]?.trim() || t(field);

  return (
    <PDP
      data={data}
      locale={locale}
      accordions={{
        detailsTitle: v('detailsTitle'),
        detailsBody: v('detailsBody'),
        shippingTitle: v('shippingTitle'),
        shippingBody: v('shippingBody'),
      }}
    />
  );
}
