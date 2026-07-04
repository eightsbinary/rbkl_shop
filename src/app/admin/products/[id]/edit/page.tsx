import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ProductForm, type ProductFormInitial } from '@/components/admin/ProductForm';
import { createServerSupabase } from '@/db/server';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = await createServerSupabase();
  const [{ data: product }, { data: axes }, { data: images }, { data: variants }] =
    await Promise.all([
      supa.from('products').select('*').eq('id', id).maybeSingle(),
      supa.from('variant_options').select('name, values, sort').eq('product_id', id).order('sort'),
      supa
        .from('product_images')
        .select('id, url_400, storage_path')
        .eq('product_id', id)
        .order('sort'),
      supa
        .from('variants')
        .select(
          'option_values, price_thb, stock_available, preorder_enabled, preorder_cap, preorder_count',
        )
        .eq('product_id', id),
    ]);
  if (!product) notFound();

  const t = await getTranslations('admin.products');

  const initial: ProductFormInitial = {
    id: product.id,
    slug: product.slug,
    status: product.status,
    name: product.name as { th: string; en: string },
    description: product.description as { th: string; en: string },
    copy: (product.copy ?? {}) as ProductFormInitial['copy'],
    basePriceThb: product.base_price_thb,
    weightGrams: product.weight_grams,
    category: product.category ?? '',
    isFeatured: product.is_featured,
    isPreorder: product.is_preorder,
    preorderShipDate: product.preorder_ship_date ?? undefined,
    axes: (axes ?? []).map((a) => ({ name: a.name, values: a.values })),
    variantOverrides: (variants ?? []).map((v) => ({
      optionValues: (v.option_values ?? {}) as Record<string, string>,
      priceThb: v.price_thb ?? null,
      stockAvailable: v.stock_available ?? 0,
      preorderEnabled: v.preorder_enabled ?? false,
      preorderCap: v.preorder_cap ?? null,
    })),
    preorderCounts: Object.fromEntries(
      (variants ?? []).map((v) => [JSON.stringify(v.option_values), v.preorder_count]),
    ),
    imageRows: images ?? [],
    heroImageId: product.hero_image_id ?? null,
  };

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">{t('editProduct')}</h1>
      <ProductForm initial={initial} />
    </div>
  );
}
