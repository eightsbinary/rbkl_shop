import 'server-only';
import { createServerSupabase } from '@/db/server';
import type { AboutContent } from '@/domain/about-content';

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
