import { notFound } from 'next/navigation';
import { ProductForm, type ProductFormInitial } from '@/components/admin/ProductForm';
import { createServerSupabase } from '@/db/server';

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supa = await createServerSupabase();
  const [{ data: product }, { data: axes }, { data: images }] = await Promise.all([
    supa.from('products').select('*').eq('id', id).maybeSingle(),
    supa.from('variant_options').select('name, values, sort').eq('product_id', id).order('sort'),
    supa.from('product_images').select('id, url_400').eq('product_id', id).order('sort'),
  ]);
  if (!product) notFound();

  const initial: ProductFormInitial = {
    id: product.id,
    slug: product.slug,
    status: product.status,
    name: product.name as { th: string; en: string },
    description: product.description as { th: string; en: string },
    basePriceThb: product.base_price_thb,
    weightGrams: product.weight_grams,
    category: product.category ?? '',
    isFeatured: product.is_featured,
    axes: (axes ?? []).map((a) => ({ name: a.name, values: a.values })),
    variantOverrides: [],
    imageRows: images ?? [],
  };

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl text-ink">Edit product</h1>
      <ProductForm initial={initial} />
    </div>
  );
}
