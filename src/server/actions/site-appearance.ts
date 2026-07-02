'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { HEX_COLOR, type SiteAppearance } from '@/domain/site-appearance';

/** Empty/null clears an override (storefront falls back to the built-in palette). */
function normalize(value: string | null): string | null {
  return value?.trim().toLowerCase() || null;
}

export async function saveSiteAppearance(
  input: SiteAppearance,
): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const bgLight = normalize(input.bgLight);
  const bgDark = normalize(input.bgDark);
  if ((bgLight && !HEX_COLOR.test(bgLight)) || (bgDark && !HEX_COLOR.test(bgDark))) {
    return { error: 'Background colors must be #rrggbb hex values' };
  }

  const svc = createServiceRoleSupabase();
  const { error } = await svc
    .from('site_appearance')
    .update({ bg_light: bgLight, bg_dark: bgDark })
    .eq('id', 'singleton');
  if (error) return { error: error.message };

  // The override is injected by the storefront layout — refresh the whole tree.
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  return { ok: true };
}
