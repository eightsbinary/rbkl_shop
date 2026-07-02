import 'server-only';
import { createServerSupabase } from '@/db/server';
import type { SiteAppearance } from '@/domain/site-appearance';

/** Storefront background overrides (anon-readable singleton). Null → built-in palette. */
export async function getSiteAppearance(): Promise<SiteAppearance> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('site_appearance')
    .select('bg_light, bg_dark')
    .eq('id', 'singleton')
    .maybeSingle();
  return { bgLight: data?.bg_light ?? null, bgDark: data?.bg_dark ?? null };
}
