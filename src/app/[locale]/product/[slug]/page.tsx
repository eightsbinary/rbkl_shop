import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { PDP } from '@/components/shop/PDP';
import type { Locale } from '@/i18n/routing';
import { getProductBySlug } from '@/server/queries/products';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await getProductBySlug(slug);
  if (!data) notFound();
  return <PDP data={data} locale={locale} />;
}
