import { getTranslations } from 'next-intl/server';
import { AboutContentForm } from '@/components/admin/AboutContentForm';
import { ABOUT_FIELDS, type AboutField } from '@/domain/about-content';
import { getAboutContent } from '@/server/queries/about';

export default async function AdminAboutPage() {
  const t = await getTranslations('admin.about');
  const [content, tEn, tTh] = await Promise.all([
    getAboutContent(),
    getTranslations({ locale: 'en', namespace: 'about' }),
    getTranslations({ locale: 'th', namespace: 'about' }),
  ]);

  // Effective values to pre-fill: stored override, else the i18n default.
  const initial = Object.fromEntries(
    ABOUT_FIELDS.map((field) => [
      field,
      {
        th: content[field]?.th ?? tTh(field),
        en: content[field]?.en ?? tEn(field),
      },
    ]),
  ) as Record<AboutField, { th: string; en: string }>;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
      <AboutContentForm initial={initial} />
    </div>
  );
}
