import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AboutHero } from '@/components/shop/AboutHero';
import { CraftSection } from '@/components/shop/CraftSection';
import { InspirationSection } from '@/components/shop/InspirationSection';
import type { AboutField } from '@/domain/about-content';
import type { Locale } from '@/i18n/routing';
import { getAboutContent, getAboutImages } from '@/server/queries/about';

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const [content, images] = await Promise.all([getAboutContent(), getAboutImages()]);

  // Admin override for this locale, else the i18n default.
  const v = (field: AboutField) => content[field]?.[locale]?.trim() || t(field);

  return (
    <>
      <AboutHero
        title={v('heroTitle')}
        body1={v('heroBody1')}
        body2={v('heroBody2')}
        image={images.hero}
      />
      <CraftSection
        title={v('craftTitle')}
        subtitle={v('craftSubtitle')}
        caption={v('craftCaption')}
        card1Title={v('card1Title')}
        card1Body={v('card1Body')}
        card2Title={v('card2Title')}
        card2Body={v('card2Body')}
        image={images.craft}
      />
      <InspirationSection
        label={v('inspirationLabel')}
        title={v('inspirationTitle')}
        body1={v('inspirationBody1')}
        body2={v('inspirationBody2')}
        image={images.inspiration}
      />
    </>
  );
}
