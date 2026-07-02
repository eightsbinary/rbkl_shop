'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { PRODUCT_COPY_FIELDS, type ProductCopy, ProductCopySchema } from '@/domain/product-copy';

/** Persist the product-page accordion copy (Details & Care / Shipping &
 *  Returns). Blank fields fall back to the i18n defaults. */
export async function saveProductCopy(
  input: ProductCopy,
): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const parsed = ProductCopySchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid product copy' };

  const content: ProductCopy = {};
  for (const field of PRODUCT_COPY_FIELDS) {
    const th = parsed.data[field]?.th?.trim();
    const en = parsed.data[field]?.en?.trim();
    if (th || en) content[field] = { ...(th ? { th } : {}), ...(en ? { en } : {}) };
  }

  const svc = createServiceRoleSupabase();
  const { error } = await svc.from('product_copy').upsert({
    id: 'singleton',
    content,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  // Copy shows on every product page; revalidate the listing roots (product
  // pages themselves are dynamic per request).
  revalidatePath('/en/shop');
  revalidatePath('/th/shop');
  revalidatePath('/admin/settings');
  return { ok: true };
}
