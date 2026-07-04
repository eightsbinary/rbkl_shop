import 'server-only';
import { createServerSupabase } from '@/db/server';
import type { Database } from '@/db/types.gen';
import { searchPattern } from '@/server/queries/search';

export type AdminDiscountRow = Pick<
  Database['public']['Tables']['discount_codes']['Row'],
  'id' | 'code' | 'kind' | 'value' | 'starts_at' | 'ends_at' | 'max_uses' | 'uses' | 'active'
>;

/** List discount codes for the admin table, newest first, optionally filtered
 *  by a code search term. */
export async function listAdminDiscounts(search?: string): Promise<AdminDiscountRow[]> {
  const supa = await createServerSupabase();
  let query = supa
    .from('discount_codes')
    .select('id, code, kind, value, starts_at, ends_at, max_uses, uses, active')
    .order('created_at', { ascending: false });
  const pattern = search ? searchPattern(search) : null;
  if (pattern) query = query.ilike('code', pattern);
  const { data } = await query;
  return data ?? [];
}
