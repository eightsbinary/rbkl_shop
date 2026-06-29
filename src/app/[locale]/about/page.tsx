import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AboutHero } from '@/components/shop/AboutHero';
import { CraftSection } from '@/components/shop/CraftSection';
import { InspirationSection } from '@/components/shop/InspirationSection';
import type { Locale } from '@/i18n/routing';

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');

  return (
    <>
      <AboutHero title={t('heroTitle')} body1={t('heroBody1')} body2={t('heroBody2')} />
      <CraftSection
        title={t('craftTitle')}
        subtitle={t('craftSubtitle')}
        caption={t('craftCaption')}
        card1Title={t('card1Title')}
        card1Body={t('card1Body')}
        card2Title={t('card2Title')}
        card2Body={t('card2Body')}
      />
      <InspirationSection
        label={t('inspirationLabel')}
        title={t('inspirationTitle')}
        body1={t('inspirationBody1')}
        body2={t('inspirationBody2')}
      />
    </>
  );
}
