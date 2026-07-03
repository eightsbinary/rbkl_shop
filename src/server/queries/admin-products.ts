import 'server-only';
import { createServerSupabase } from '@/db/server';
import { searchPattern } from '@/server/queries/search';

export interface AdminProductRow {
  id: string;
  slug: string;
  status: string;
  name: unknown;
  base_price_thb: number;
  is_featured: boolean;
  hero_image: { url_400: string | null } | { url_400: string | null }[] | null;
}

/** List products for the admin grid, recently updated first, optionally
 *  filtered by a search term (slug or localized name). */
export async function listAdminProducts(search?: string): Promise<AdminProductRow[]> {
  const supa = await createServerSupabase();
  let query = supa
    .from('products')
    .select(
      'id, slug, status, name, base_price_thb, is_featured, hero_image:product_images!products_hero_image_fk(url_400)',
    )
    .order('updated_at', { ascending: false });
  const pattern = search ? searchPattern(search) : null;
  if (pattern) {
    query = query.or(`slug.ilike.${pattern},name->>en.ilike.${pattern},name->>th.ilike.${pattern}`);
  }
  const { data } = await query;
  return data ?? [];
}
