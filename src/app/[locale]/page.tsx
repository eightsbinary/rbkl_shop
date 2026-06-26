import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n/routing';

export default async function LandingPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('landing');

  return (
    <section className="px-6 py-32 text-center space-y-6">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">rb_shop</p>
      <h1 className="font-serif text-5xl md:text-7xl text-ink">
        {t('heroLine1')}
        <br />
        {t('heroLine2')}
      </h1>
    </section>
  );
}
