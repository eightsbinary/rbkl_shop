import 'server-only';
import { createServerSupabase } from '@/db/server';

export interface WaitlistGroup {
  variantId: string;
  productName: string;
  optionLabel: string;
  slug: string;
  stockAvailable: number;
  /** Number of pending (not-yet-notified) waiters. */
  count: number;
  /** Created_at of the earliest pending waiter. */
  earliest: string;
}

type Nested<T> = T | T[] | null;
const one = <T>(v: Nested<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

/** Pending waitlist entries grouped by variant, busiest first. */
export async function listWaitlistGroups(): Promise<WaitlistGroup[]> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('waitlist_entries')
    .select(
      'variant_id, created_at, variants(stock_available, option_values, products(name, slug))',
    )
    .is('notified_at', null)
    .order('created_at', { ascending: true });

  const groups = new Map<string, WaitlistGroup>();
  for (const row of data ?? []) {
    if (!row.variant_id) continue;
    const existing = groups.get(row.variant_id);
    if (existing) {
      existing.count += 1;
      continue;
    }
    const variant = one(row.variants);
    const product = one(variant?.products ?? null);
    const nameObj = (product?.name ?? {}) as { en?: string; th?: string };
    const opts = (variant?.option_values ?? null) as Record<string, string> | null;
    groups.set(row.variant_id, {
      variantId: row.variant_id,
      productName: nameObj.en ?? nameObj.th ?? product?.slug ?? 'product',
      optionLabel: opts ? Object.values(opts).join(' / ') : '',
      slug: product?.slug ?? '',
      stockAvailable: variant?.stock_available ?? 0,
      count: 1,
      earliest: row.created_at,
    });
  }

  return [...groups.values()].sort((a, b) => b.count - a.count);
}
