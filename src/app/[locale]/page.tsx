import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeaturedBento } from '@/components/shop/FeaturedBento';
import { Hero } from '@/components/shop/Hero';
import { NewsletterBand } from '@/components/shop/NewsletterBand';
import { Button } from '@/components/ui/Button';
import type { Locale } from '@/i18n/routing';
import { listFeaturedProducts } from '@/server/queries/products';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const featured = await listFeaturedProducts(4);

  // Brand hero image (public asset, matches the Figma design).
  const heroImg = '/hero.png';
  const heroName = `${t('heroLine1')} ${t('heroLine2')}`;

  return (
    <>
      <Hero
        locale={locale}
        title={`${t('heroLine1')} ${t('heroLine2')}`}
        subtitle={t('heroSubtitle')}
        cta={t('heroCta')}
        imageUrl={heroImg}
        imageAlt={heroName}
      />

      {featured.length > 0 && (
        <section className="container mx-auto space-y-16 px-6 py-24 lg:px-16">
          <div className="flex items-end justify-between border-b border-line pb-4">
            <h2 className="font-serif text-3xl text-ink">{t('featuredTitle')}</h2>
            <Link
              href={`/${locale}/shop`}
              className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-ink"
            >
              {t('viewAll')}
            </Link>
          </div>

          <FeaturedBento products={featured} locale={locale} />

          <div className="flex justify-center">
            <Link href={`/${locale}/shop`}>
              <Button variant="outline" size="md">
                {t('viewCollection')}
              </Button>
            </Link>
          </div>
        </section>
      )}

      <NewsletterBand
        title={t('journalTitle')}
        subtitle={t('journalSubtitle')}
        placeholder={t('journalPlaceholder')}
        cta={t('journalCta')}
        thanks={t('journalThanks')}
      />
    </>
  );
}
