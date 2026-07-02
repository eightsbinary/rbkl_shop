import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { createServerSupabase } from '@/db/server';
import type { Locale } from '@/i18n/routing';

export default async function CheckoutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('checkout');

  const supa = await createServerSupabase();
  const { data: zones } = await supa
    .from('shipping_zones')
    .select('code, flat_rate_thb, countries')
    .eq('is_active', true)
    .order('sort');

  const shaped = (zones ?? []).map((z) => ({
    code: z.code,
    flatRateThb: z.flat_rate_thb,
    countries: z.countries,
  }));

  return (
    <section className="container mx-auto px-6 py-16 space-y-12">
      <h1 className="font-serif text-4xl text-ink">{t('title')}</h1>
      <CheckoutForm zones={shaped} />
    </section>
  );
}
