// Pure sales-summary math for the admin dashboard. Inputs are paid orders
// only; the query layer filters by status.

export interface PaidOrderLike {
  totalThb: number;
  /** ISO timestamp of payment. */
  paidAt: string;
  shipStatus: string;
}

export interface PeriodStats {
  revenueThb: number;
  orders: number;
}

export interface SalesSummary {
  today: PeriodStats;
  last7d: PeriodStats;
  last30d: PeriodStats;
  allTime: PeriodStats;
  /** All-time average order value, rounded to whole baht. */
  aovThb: number;
  /** Paid orders not yet shipped (ship_status pending/preparing). */
  toShip: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
// The shop operates on Thai time (UTC+7, no DST), so "today" starts at
// Bangkok midnight regardless of server timezone.
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function bangkokMidnight(now: Date): number {
  const shifted = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return (
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
    BANGKOK_OFFSET_MS
  );
}

export function summarizeSales(paid: PaidOrderLike[], now: Date = new Date()): SalesSummary {
  const todayStart = bangkokMidnight(now);
  const d7Start = now.getTime() - 7 * DAY_MS;
  const d30Start = now.getTime() - 30 * DAY_MS;

  const stats = (since: number): PeriodStats => {
    const rows = paid.filter((o) => Date.parse(o.paidAt) >= since);
    return {
      revenueThb: rows.reduce((sum, o) => sum + o.totalThb, 0),
      orders: rows.length,
    };
  };

  const allTime = stats(Number.NEGATIVE_INFINITY);
  return {
    today: stats(todayStart),
    last7d: stats(d7Start),
    last30d: stats(d30Start),
    allTime,
    aovThb: allTime.orders === 0 ? 0 : Math.round(allTime.revenueThb / allTime.orders),
    toShip: paid.filter((o) => o.shipStatus === 'pending' || o.shipStatus === 'preparing').length,
  };
}

export interface SoldItemLike {
  productId: string;
  qty: number;
  name: { th?: string; en?: string };
}

export interface TopProduct extends SoldItemLike {
  qty: number;
}

/** Aggregate sold quantities per product, best sellers first. */
export function topProducts(items: SoldItemLike[], limit = 4): TopProduct[] {
  const byProduct = new Map<string, TopProduct>();
  for (const item of items) {
    const existing = byProduct.get(item.productId);
    if (existing) existing.qty += item.qty;
    else byProduct.set(item.productId, { ...item });
  }
  return [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}
