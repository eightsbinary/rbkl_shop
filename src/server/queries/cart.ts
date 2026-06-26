import 'server-only';
import { createServerSupabase } from '@/db/server';

export interface CartPreviewLine {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: { th?: string; en?: string };
  optionValues: Record<string, string>;
  unitPriceThb: number;
  imageUrl: string | null;
  stockAvailable: number;
}

export async function previewCart(variantIds: string[]): Promise<CartPreviewLine[]> {
  if (variantIds.length === 0) return [];
  const supa = await createServerSupabase();
  const { data, error } = await supa
    .from('variants')
    .select(
      `id, option_values, price_thb, stock_available, is_active,
       product:products!inner(id, slug, name, base_price_thb, status,
         hero_image:product_images!products_hero_image_fk(url_400))`,
    )
    .in('id', variantIds);
  if (error || !data) return [];

  return data
    .map((v) => {
      if (!v.is_active) return null;
      const p = Array.isArray(v.product) ? v.product[0] : v.product;
      if (p?.status !== 'active') return null;
      const heroAny = (p as { hero_image?: unknown }).hero_image;
      const hero = Array.isArray(heroAny) ? heroAny[0] : heroAny;
      return {
        variantId: v.id,
        productId: p.id,
        productSlug: p.slug,
        productName: p.name as { th?: string; en?: string },
        optionValues: v.option_values as Record<string, string>,
        unitPriceThb: v.price_thb ?? p.base_price_thb,
        imageUrl: (hero as { url_400?: string } | null)?.url_400 ?? null,
        stockAvailable: v.stock_available,
      };
    })
    .filter((l): l is CartPreviewLine => l !== null);
}
