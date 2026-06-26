import 'server-only';
import { createServerSupabase } from '@/db/client';
import type { Database } from '@/db/types.gen';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ImageRow = Database['public']['Tables']['product_images']['Row'];
type VariantRow = Database['public']['Tables']['variants']['Row'];

export interface ProductCardData {
  id: string;
  slug: string;
  name: { th?: string; en?: string };
  basePriceThb: number;
  heroImage: Pick<ImageRow, 'url_400' | 'url_800' | 'url_1600' | 'alt'> | null;
}

function rowToCard(p: {
  id: string;
  slug: string;
  name: unknown;
  base_price_thb: number;
  hero_image: unknown;
}): ProductCardData {
  const hero = Array.isArray(p.hero_image)
    ? ((p.hero_image[0] as ImageRow | null) ?? null)
    : (p.hero_image as ImageRow | null);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name as { th?: string; en?: string },
    basePriceThb: p.base_price_thb,
    heroImage: hero,
  };
}

export async function listActiveProducts(limit = 24): Promise<ProductCardData[]> {
  const supa = await createServerSupabase();
  const { data, error } = await supa
    .from('products')
    .select(
      'id, slug, name, base_price_thb, hero_image:product_images!products_hero_image_fk(url_400, url_800, url_1600, alt)',
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(rowToCard);
}

export async function listFeaturedProducts(limit = 3): Promise<ProductCardData[]> {
  const supa = await createServerSupabase();
  const { data, error } = await supa
    .from('products')
    .select(
      'id, slug, name, base_price_thb, hero_image:product_images!products_hero_image_fk(url_400, url_800, url_1600, alt)',
    )
    .eq('status', 'active')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(rowToCard);
}

export interface ProductDetailData {
  product: ProductRow;
  images: ImageRow[];
  variants: VariantRow[];
  options: { name: string; values: string[] }[];
}

export async function getProductBySlug(slug: string): Promise<ProductDetailData | null> {
  const supa = await createServerSupabase();
  const { data: product, error } = await supa
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !product) return null;

  const [images, variants, options] = await Promise.all([
    supa.from('product_images').select('*').eq('product_id', product.id).order('sort'),
    supa.from('variants').select('*').eq('product_id', product.id).eq('is_active', true),
    supa.from('variant_options').select('name, values').eq('product_id', product.id).order('sort'),
  ]);
  return {
    product,
    images: images.data ?? [],
    variants: variants.data ?? [],
    options: (options.data ?? []) as { name: string; values: string[] }[],
  };
}
