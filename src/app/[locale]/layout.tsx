import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { Footer } from '@/components/shop/Footer';
import { Header } from '@/components/shop/Header';
import { routing } from '@/i18n/routing';

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

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Header />
      <main id="main" className="min-h-[calc(100vh-12rem)]">
        {children}
      </main>
      <Footer />
      <CartDrawer />
    </NextIntlClientProvider>
  );
}
