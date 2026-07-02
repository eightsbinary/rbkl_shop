import { getTranslations } from 'next-intl/server';
import { HomeHeroForm } from '@/components/admin/HomeHeroForm';
import { HOME_FIELDS, type HomeField } from '@/domain/home-content';
import { getHomeHero, listHomeAssets } from '@/server/queries/home';

export default async function AdminHomePage() {
  const t = await getTranslations('admin.home');
  const [hero, library, tEn, tTh] = await Promise.all([
    getHomeHero(),
    listHomeAssets(),
    getTranslations({ locale: 'en', namespace: 'landing' }),
    getTranslations({ locale: 'th', namespace: 'landing' }),
  ]);

  // Effective values to pre-fill: stored override, else the i18n default.
  const initial = Object.fromEntries(
    HOME_FIELDS.map((field) => [
      field,
      {
        th: hero.content[field]?.th ?? tTh(field),
        en: hero.content[field]?.en ?? tEn(field),
      },
    ]),
  ) as Record<HomeField, { th: string; en: string }>;

  return (
    <div className="max-w-3xl space-y-8">
      <h1 className="font-serif text-3xl text-ink">{t('title')}</h1>
      <HomeHeroForm initial={initial} initialImagePath={hero.imagePath} library={library} />
    </div>
  );
}
