import 'server-only';
import { createServerSupabase } from '@/db/server';
import {
  type AboutContent,
  type AboutImageSection,
  type AboutImages,
  DEFAULT_ABOUT_IMAGES,
} from '@/domain/about-content';

/** The stored About-page overrides. Empty object if unset — callers fall back
 *  to the i18n defaults per field. Public read (anon-readable RLS policy). */
export async function getAboutContent(): Promise<AboutContent> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('about_content')
    .select('content')
    .eq('id', 'singleton')
    .maybeSingle();
  return (data?.content as AboutContent) ?? {};
}

/** Raw stored image paths per section (admin editor state). */
export async function getAboutImagePaths(): Promise<AboutImages> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('about_content')
    .select('images')
    .eq('id', 'singleton')
    .maybeSingle();
  return (data?.images as AboutImages) ?? {};
}

/** Resolved image URL per section: the selected upload's public URL, or the
 *  built-in /public default when nothing is selected. */
export async function getAboutImages(): Promise<Record<AboutImageSection, string>> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('about_content')
    .select('images')
    .eq('id', 'singleton')
    .maybeSingle();
  const stored = (data?.images as AboutImages) ?? {};

  return Object.fromEntries(
    Object.entries(DEFAULT_ABOUT_IMAGES).map(([section, fallback]) => {
      const path = stored[section as AboutImageSection];
      return [
        section,
        path ? supa.storage.from('about-assets').getPublicUrl(path).data.publicUrl : fallback,
      ];
    }),
  ) as Record<AboutImageSection, string>;
}

/** Every uploaded About image (the admin picker's library), newest first. */
export async function listAboutAssets(): Promise<Array<{ path: string; url: string }>> {
  const supa = await createServerSupabase();
  const { data } = await supa.storage
    .from('about-assets')
    .list('about', { sortBy: { column: 'created_at', order: 'desc' } });
  return (data ?? []).map((f) => {
    const path = `about/${f.name}`;
    return { path, url: supa.storage.from('about-assets').getPublicUrl(path).data.publicUrl };
  });
}
