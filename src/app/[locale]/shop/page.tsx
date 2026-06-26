import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProductGrid } from '@/components/shop/ProductGrid';
import type { Locale } from '@/i18n/routing';
import { listActiveProducts } from '@/server/queries/products';

export default async function ShopPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('shop');
  const products = await listActiveProducts();

  return (
    <section className="container mx-auto px-6 py-16 space-y-12">
      <h1 className="font-serif text-4xl text-ink">{t('title')}</h1>
      {products.length === 0 ? (
        <p className="text-muted">{t('emptyState')}</p>
      ) : (
        <ProductGrid products={products} locale={locale} />
      )}
    </section>
  );
}
