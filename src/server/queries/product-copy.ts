import 'server-only';
import { createServerSupabase } from '@/db/server';
import type { ProductCopy } from '@/domain/product-copy';

/** Stored product-page copy overrides. Empty object if unset — callers fall
 *  back to the i18n defaults per field. Public read (anon-readable RLS). */
export async function getProductCopy(): Promise<ProductCopy> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('product_copy')
    .select('content')
    .eq('id', 'singleton')
    .maybeSingle();
  return (data?.content as ProductCopy) ?? {};
}
