import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProductGrid } from '@/components/shop/ProductGrid';
import type { Locale } from '@/i18n/routing';
import { listFeaturedProducts } from '@/server/queries/products';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const featured = await listFeaturedProducts(3);

  return (
    <>
      <section className="container mx-auto px-6 pt-24 pb-16 text-center space-y-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">rainbykello</p>
        <h1 className="font-serif text-5xl md:text-7xl text-ink leading-tight">
          {t('heroLine1')}
          <br />
          {t('heroLine2')}
        </h1>
      </section>

      {featured.length > 0 && (
        <section className="container mx-auto px-6 pb-24 space-y-8">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl text-ink">{t('featuredTitle')}</h2>
            <Link
              href={`/${locale}/shop`}
              className="text-sm uppercase tracking-[0.2em] text-muted hover:text-ink transition-colors"
            >
              {t('viewAll')}
            </Link>
          </div>
          <ProductGrid products={featured} locale={locale} />
        </section>
      )}
    </>
  );
}
