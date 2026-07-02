import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ReceiptDoc } from '@/components/order/ReceiptDoc';
import type { Locale } from '@/i18n/routing';
import { getOrderForGuest } from '@/server/queries/orders';
import { PrintButton } from './PrintButton';

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { locale, id } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);
  if (!token) notFound();
  const data = await getOrderForGuest(id, token);
  if (!data) notFound();

  return (
    <section className="light-scope bg-paper-warm py-12 print:bg-white print:py-0">
      <div className="container mx-auto px-6 print:px-0">
        <div className="mb-6 flex justify-end print:hidden">
          <PrintButton />
        </div>
        <ReceiptDoc order={data.order} items={data.items} locale={locale} />
      </div>
    </section>
  );
}
