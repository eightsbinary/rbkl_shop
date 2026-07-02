import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { Footer } from '@/components/shop/Footer';
import { Header } from '@/components/shop/Header';
import { buildAppearanceCss } from '@/domain/site-appearance';
import { routing } from '@/i18n/routing';
import { getSiteAppearance } from '@/server/queries/site-appearance';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  // Admin-managed background override; values are hex-validated at write time
  // and re-checked inside buildAppearanceCss before touching CSS.
  const appearanceCss = buildAppearanceCss(await getSiteAppearance());

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {appearanceCss && <style>{appearanceCss}</style>}
      <Header />
      <main id="main" className="min-h-[calc(100vh-12rem)]">
        {children}
      </main>
      <Footer />
    </NextIntlClientProvider>
  );
}
