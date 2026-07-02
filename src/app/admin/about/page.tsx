import { getTranslations } from 'next-intl/server';
import { AboutContentForm } from '@/components/admin/AboutContentForm';
import { AboutImagesForm } from '@/components/admin/AboutImagesForm';
import {
  ABOUT_FIELDS,
  ABOUT_IMAGE_SECTIONS,
  type AboutField,
  type AboutImageSection,
} from '@/domain/about-content';
import { getAboutContent, getAboutImagePaths, listAboutAssets } from '@/server/queries/about';

export default async function AdminAboutPage() {
  const t = await getTranslations('admin.about');
  const [content, imagePaths, library, tEn, tTh] = await Promise.all([
    getAboutContent(),
    getAboutImagePaths(),
    listAboutAssets(),
    getTranslations({ locale: 'en', namespace: 'about' }),
    getTranslations({ locale: 'th', namespace: 'about' }),
  ]);

  const initialImages = Object.fromEntries(
    ABOUT_IMAGE_SECTIONS.map((s) => [s, imagePaths[s] ?? null]),
  ) as Record<AboutImageSection, string | null>;

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

      <section className="space-y-6 border-t border-line pt-12">
        <h2 className="font-serif text-xl text-ink">{t('images.heading')}</h2>
        <p className="text-sm text-muted">{t('images.hint')}</p>
        <AboutImagesForm initial={initialImages} library={library} />
      </section>
    </div>
  );
}
