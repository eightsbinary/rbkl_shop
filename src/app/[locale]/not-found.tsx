import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/Button';

/** Localized 404, rendered inside the storefront chrome (Header/Footer via the
 *  locale layout) for unmatched paths under a valid locale. */
export default async function LocaleNotFound() {
  const t = await getTranslations('notFound');
  const locale = await getLocale();

  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-24 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-muted">{t('eyebrow')}</p>
      <h1 className="mt-4 font-serif text-4xl text-ink lg:text-5xl">{t('title')}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{t('body')}</p>
      <Link href={`/${locale}`} className="mt-8">
        <Button variant="outline" size="md">
          {t('cta')}
        </Button>
      </Link>
    </section>
  );
}
