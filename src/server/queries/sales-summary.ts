import 'server-only';
import { createServerSupabase } from '@/db/server';
import {
  type SalesSummary,
  summarizeSales,
  type TopProduct,
  topProducts,
} from '@/domain/sales-summary';

export interface SalesDashboard {
  summary: SalesSummary;
  /** Orders still waiting for a payment slip. */
  awaitingPayment: number;
  top: TopProduct[];
}

/** Everything the admin dashboard's stats row needs, in one round trip set.
 *  Reads run under the admin's session (owner/dev RLS on orders). */
export async function getSalesDashboard(): Promise<SalesDashboard> {
  const supa = await createServerSupabase();
  const [paidRes, awaitingRes, itemsRes] = await Promise.all([
    supa.from('orders').select('total_thb, paid_at, ship_status').eq('status', 'paid'),
    supa
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'awaiting_payment'),
    supa
      .from('order_items')
      .select('qty, product_snapshot, orders!inner(status)')
      .eq('orders.status', 'paid'),
  ]);

  const summary = summarizeSales(
    (paidRes.data ?? [])
      .filter((o) => o.paid_at !== null)
      .map((o) => ({
        totalThb: o.total_thb,
        paidAt: o.paid_at as string,
        shipStatus: o.ship_status,
      })),
  );

  const top = topProducts(
    (itemsRes.data ?? []).map((row) => {
      const snap = row.product_snapshot as {
        productId?: string;
        name?: { th?: string; en?: string };
      };
      return {
        productId: snap.productId ?? 'unknown',
        qty: row.qty,
        name: snap.name ?? {},
      };
    }),
  );

  return { summary, awaitingPayment: awaitingRes.count ?? 0, top };
}
