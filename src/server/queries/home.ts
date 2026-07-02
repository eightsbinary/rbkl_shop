import 'server-only';
import { createServerSupabase } from '@/db/server';
import { DEFAULT_HOME_HERO_IMAGE, type HomeContent } from '@/domain/home-content';

export interface HomeHero {
  /** Bilingual text overrides; absent fields fall back to i18n. */
  content: HomeContent;
  /** Resolved image URL (public storage URL, or the built-in default). */
  imageUrl: string;
  /** Raw stored path (admin editor state); null → default image. */
  imagePath: string | null;
}

/** The homepage hero's stored overrides. Public read (anon-readable RLS). */
export async function getHomeHero(): Promise<HomeHero> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('home_content')
    .select('content, images')
    .eq('id', 'singleton')
    .maybeSingle();

  const imagePath = (data?.images as { hero?: string })?.hero ?? null;
  return {
    content: (data?.content as HomeContent) ?? {},
    imageUrl: imagePath
      ? supa.storage.from('home-assets').getPublicUrl(imagePath).data.publicUrl
      : DEFAULT_HOME_HERO_IMAGE,
    imagePath,
  };
}

/** Every uploaded homepage image (the admin picker's library), newest first. */
export async function listHomeAssets(): Promise<Array<{ path: string; url: string }>> {
  const supa = await createServerSupabase();
  const { data } = await supa.storage
    .from('home-assets')
    .list('home', { sortBy: { column: 'created_at', order: 'desc' } });
  return (data ?? []).map((f) => {
    const path = `home/${f.name}`;
    return { path, url: supa.storage.from('home-assets').getPublicUrl(path).data.publicUrl };
  });
}
