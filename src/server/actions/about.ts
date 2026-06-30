'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { ABOUT_FIELDS, type AboutContent, AboutContentSchema } from '@/domain/about-content';

export async function saveAboutContent(
  input: AboutContent,
): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const parsed = AboutContentSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid about content' };

  // Persist only known fields; drop blanks so the page falls back to the
  // i18n default for any field the admin clears.
  const content: AboutContent = {};
  for (const field of ABOUT_FIELDS) {
    const th = parsed.data[field]?.th?.trim();
    const en = parsed.data[field]?.en?.trim();
    if (th || en) content[field] = { ...(th ? { th } : {}), ...(en ? { en } : {}) };
  }

  const svc = createServiceRoleSupabase();
  const { error } = await svc.from('about_content').upsert({
    id: 'singleton',
    content,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  revalidatePath('/en/about');
  revalidatePath('/th/about');
  return { ok: true };
}
