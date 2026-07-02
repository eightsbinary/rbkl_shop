'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import {
  HOME_FIELDS,
  type HomeContent,
  HomeContentSchema,
  HomeImageInputSchema,
} from '@/domain/home-content';

/** Persist the homepage hero: bilingual text overrides + image selection
 *  (storage path in home-assets; null → the built-in /hero.png). */
export async function saveHomeHero(input: {
  content: HomeContent;
  image: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const parsedContent = HomeContentSchema.safeParse(input.content);
  const parsedImage = HomeImageInputSchema.safeParse(input.image);
  if (!parsedContent.success || !parsedImage.success) {
    return { error: 'Invalid home hero content' };
  }

  // Persist only known fields; drop blanks so the page falls back to the
  // i18n default for any field the admin clears.
  const content: HomeContent = {};
  for (const field of HOME_FIELDS) {
    const th = parsedContent.data[field]?.th?.trim();
    const en = parsedContent.data[field]?.en?.trim();
    if (th || en) content[field] = { ...(th ? { th } : {}), ...(en ? { en } : {}) };
  }

  const svc = createServiceRoleSupabase();
  const { error } = await svc.from('home_content').upsert({
    id: 'singleton',
    content,
    images: parsedImage.data === null ? {} : { hero: parsedImage.data },
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath('/en');
  revalidatePath('/th');
  revalidatePath('/admin/home');
  return { ok: true };
}
