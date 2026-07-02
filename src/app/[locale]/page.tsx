import Image from 'next/image';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FeaturedBento } from '@/components/shop/FeaturedBento';
import { Hero } from '@/components/shop/Hero';
import { NewsletterBand } from '@/components/shop/NewsletterBand';
import { Button } from '@/components/ui/Button';
import type { HomeField } from '@/domain/home-content';
import type { Locale } from '@/i18n/routing';
import { getHomeHero } from '@/server/queries/home';
import { listFeaturedProducts } from '@/server/queries/products';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');
  const [featured, hero] = await Promise.all([listFeaturedProducts(4), getHomeHero()]);

  // Admin override for this locale, else the i18n default.
  const v = (field: HomeField) => hero.content[field]?.[locale]?.trim() || t(field);
  const heroName = `${v('heroLine1')} ${v('heroLine2')}`;

  return (
    <>
      <Hero
        locale={locale}
        title={heroName}
        subtitle={v('heroSubtitle')}
        cta={v('heroCta')}
        imageUrl={hero.imageUrl}
        imageAlt={heroName}
      />

      {featured.length > 0 && (
        <section className="container mx-auto space-y-16 px-6 py-24 lg:px-16">
          <div className="flex items-end justify-between border-b border-line pb-4">
            <h2 className="flex items-center gap-3 font-serif text-3xl text-ink">
              <Image src="/cross-ornate.svg" alt="" width={22} height={22} />
              {t('featuredTitle')}
            </h2>
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
        locale={locale}
        title={t('journalTitle')}
        subtitle={t('journalSubtitle')}
        placeholder={t('journalPlaceholder')}
        cta={t('journalCta')}
        thanks={t('journalThanks')}
        error={t('journalError')}
      />
    </>
  );
}
