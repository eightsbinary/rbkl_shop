'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase } from '@/db/server';
import { PRODUCT_COPY_FIELDS } from '@/domain/product-copy';
import { slugify } from '@/domain/slugify';
import { diffVariants, generateVariants, type VariantAxis } from '@/domain/variant-matrix';

const I18nString = z.object({ th: z.string().default(''), en: z.string().default('') });

const ProductInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).optional(),
  status: z.enum(['draft', 'active', 'archived']),
  name: I18nString,
  description: I18nString,
  /** Optional per-product accordion copy override (details/shipping). */
  copy: z.record(z.string(), I18nString).default({}),
  basePriceThb: z.number().int().nonnegative(),
  weightGrams: z.number().int().nonnegative().default(0),
  category: z.string().nullish(),
  isFeatured: z.boolean().default(false),
  isPreorder: z.boolean().optional(),
  preorderShipDate: z.string().nullish(),
  axes: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  variantOverrides: z.array(
    z.object({
      optionValues: z.record(z.string(), z.string()),
      priceThb: z.number().int().nullable(),
      stockAvailable: z.number().int().nonnegative(),
      preorderEnabled: z.boolean().default(false),
      preorderCap: z.number().int().nonnegative().nullable().default(null),
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
  if (axes.length > 0) {
    await supa.from('variant_options').insert(
      axes.map((a, i) => ({
        product_id: productId,
        name: a.name,
        values: [...a.values],
        sort: i,
      })),
    );
  }

  const drafts = generateVariants(axes);
  const { data: existing } = await supa
    .from('variants')
    .select('id, option_values')
    .eq('product_id', productId);
  const existingRows = (existing ?? []).map((e) => ({
    id: e.id,
    option_values: e.option_values as Record<string, string>,
  }));

  const { add, removeIds } = diffVariants(
    existingRows,
    drafts.map((d) => d.optionValues),
  );

  if (removeIds.length > 0) await supa.from('variants').delete().in('id', removeIds);

  const findOverride = (opts: Record<string, string>) =>
    overrides.find((o) => Object.entries(opts).every(([k, v]) => o.optionValues[k] === v));

  for (const e of existingRows) {
    if (removeIds.includes(e.id)) continue;
    const ov = findOverride(e.option_values);
    if (!ov) continue;
    await supa
      .from('variants')
      .update({
        price_thb: ov.priceThb ?? null,
        stock_available: ov.stockAvailable,
        preorder_enabled: ov.preorderEnabled ?? false,
        preorder_cap: ov.preorderCap ?? null,
      })
      .eq('id', e.id);
  }

  if (add.length > 0) {
    const baseIdx = existingRows.length;
    await supa.from('variants').insert(
      add.map((opts, i) => {
        const ov = findOverride(opts);
        return {
          product_id: productId,
          sku: `${productId.slice(0, 8)}-${baseIdx + i}`,
          option_values: opts,
          price_thb: ov?.priceThb ?? null,
          stock_available: ov?.stockAvailable ?? 0,
          preorder_enabled: ov?.preorderEnabled ?? false,
          preorder_cap: ov?.preorderCap ?? null,
          is_active: true,
        };
      }),
    );
  }
}

export async function saveProduct(raw: ProductInputT) {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;
  const input = ProductInput.parse(raw);

  const slug =
    input.slug ?? slugify(input.name.en || input.name.th, { fallback: `product-${Date.now()}` });
  const nameJson = { th: input.name.th, en: input.name.en };
  const descJson = { th: input.description.th, en: input.description.en };
  // Keep only known accordion fields with at least one non-blank locale.
  const copyJson = Object.fromEntries(
    PRODUCT_COPY_FIELDS.flatMap((field) => {
      const v = input.copy[field];
      const th = v?.th?.trim() ?? '';
      const en = v?.en?.trim() ?? '';
      return th || en ? [[field, { th, en }]] : [];
    }),
  );

  if (input.id) {
    const { error } = await supa
      .from('products')
      .update({
        slug,
        status: input.status,
        name: nameJson,
        description: descJson,
        copy: copyJson,
        base_price_thb: input.basePriceThb,
        weight_grams: input.weightGrams,
        category: input.category ?? null,
        is_featured: input.isFeatured,
        is_preorder: input.isPreorder ?? false,
        preorder_ship_date: input.preorderShipDate ?? null,
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
      copy: copyJson,
      base_price_thb: input.basePriceThb,
      weight_grams: input.weightGrams,
      category: input.category ?? null,
      is_featured: input.isFeatured,
      is_preorder: input.isPreorder ?? false,
      preorder_ship_date: input.preorderShipDate ?? null,
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
  const gate = await stepUpGuard(supa);
  if (gate) return gate;
  const { error } = await supa.from('products').update({ status: 'archived' }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/[locale]', 'page');
  return { ok: true as const };
}
