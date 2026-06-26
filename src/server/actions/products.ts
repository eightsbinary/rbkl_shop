'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireOwnerOrDev } from '@/db/auth';
import { createServerSupabase } from '@/db/client';
import { slugify } from '@/domain/slugify';
import { generateVariants, type VariantAxis } from '@/domain/variant-matrix';

const I18nString = z.object({ th: z.string().default(''), en: z.string().default('') });

const ProductInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).optional(),
  status: z.enum(['draft', 'active', 'archived']),
  name: I18nString,
  description: I18nString,
  basePriceThb: z.number().int().nonnegative(),
  weightGrams: z.number().int().nonnegative().default(0),
  category: z.string().nullish(),
  isFeatured: z.boolean().default(false),
  axes: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  variantOverrides: z.array(
    z.object({
      optionValues: z.record(z.string(), z.string()),
      priceThb: z.number().int().nullable(),
      stockAvailable: z.number().int().nonnegative(),
    }),
  ),
});

export type ProductInputT = z.infer<typeof ProductInput>;

type Supa = Awaited<ReturnType<typeof createServerSupabase>>;

async function syncVariants(
  supa: Supa,
  productId: string,
  axes: VariantAxis[],
  overrides: ProductInputT['variantOverrides'],
) {
  await supa.from('variant_options').delete().eq('product_id', productId);
  if (axes.length === 0) return;

  await supa.from('variant_options').insert(
    axes.map((a, i) => ({
      product_id: productId,
      name: a.name,
      values: [...a.values],
      sort: i,
    })),
  );

  await supa.from('variants').delete().eq('product_id', productId);
  const drafts = generateVariants(axes);
  const rows = drafts.map((d, i) => {
    const ov = overrides.find((o) =>
      Object.entries(d.optionValues).every(([k, v]) => o.optionValues[k] === v),
    );
    return {
      product_id: productId,
      sku: `${productId.slice(0, 8)}-${i}`,
      option_values: d.optionValues,
      price_thb: ov?.priceThb ?? null,
      stock_available: ov?.stockAvailable ?? 0,
      is_active: true,
    };
  });
  if (rows.length > 0) {
    await supa.from('variants').insert(rows);
  }
}

export async function saveProduct(raw: ProductInputT) {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const input = ProductInput.parse(raw);

  const slug =
    input.slug ?? slugify(input.name.en || input.name.th, { fallback: `product-${Date.now()}` });
  const nameJson = { th: input.name.th, en: input.name.en };
  const descJson = { th: input.description.th, en: input.description.en };

  if (input.id) {
    const { error } = await supa
      .from('products')
      .update({
        slug,
        status: input.status,
        name: nameJson,
        description: descJson,
        base_price_thb: input.basePriceThb,
        weight_grams: input.weightGrams,
        category: input.category ?? null,
        is_featured: input.isFeatured,
      })
      .eq('id', input.id);
    if (error) return { error: error.message };
    await syncVariants(supa, input.id, input.axes, input.variantOverrides);
    revalidatePath('/[locale]', 'page');
    revalidatePath(`/[locale]/product/${slug}`, 'page');
    return { ok: true as const, id: input.id, slug };
  }

  const { data, error } = await supa
    .from('products')
    .insert({
      slug,
      status: input.status,
      name: nameJson,
      description: descJson,
      base_price_thb: input.basePriceThb,
      weight_grams: input.weightGrams,
      category: input.category ?? null,
      is_featured: input.isFeatured,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'Insert failed' };

  await syncVariants(supa, data.id, input.axes, input.variantOverrides);
  revalidatePath('/[locale]', 'page');
  return { ok: true as const, id: data.id, slug };
}

export async function archiveProduct(id: string) {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const { error } = await supa.from('products').update({ status: 'archived' }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/[locale]', 'page');
  return { ok: true as const };
}
