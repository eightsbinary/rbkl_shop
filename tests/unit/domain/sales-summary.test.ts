import { describe, expect, it } from 'vitest';
import { summarizeSales, topProducts } from '@/domain/sales-summary';

// now = 2026-07-02T10:00:00Z → 17:00 Bangkok; Bangkok midnight = 2026-07-01T17:00:00Z.
const NOW = new Date('2026-07-02T10:00:00Z');

const paid = (paidAt: string, totalThb: number, shipStatus = 'pending') => ({
  totalThb,
  paidAt,
  shipStatus,
});

describe('summarizeSales', () => {
  it('returns zeros for no orders', () => {
    const s = summarizeSales([], NOW);
    expect(s.today).toEqual({ revenueThb: 0, orders: 0 });
    expect(s.allTime).toEqual({ revenueThb: 0, orders: 0 });
    expect(s.aovThb).toBe(0);
    expect(s.toShip).toBe(0);
  });

  it('counts "today" from Bangkok midnight, not UTC midnight', () => {
    const s = summarizeSales(
      [
        paid('2026-07-01T18:00:00Z', 100), // 01:00 BKK today → today
        paid('2026-07-01T16:59:00Z', 200), // 23:59 BKK yesterday → not today
      ],
      NOW,
    );
    expect(s.today).toEqual({ revenueThb: 100, orders: 1 });
    expect(s.last7d).toEqual({ revenueThb: 300, orders: 2 });
  });

  it('applies rolling 7-day and 30-day windows', () => {
    const s = summarizeSales(
      [
        paid('2026-06-26T10:00:01Z', 100), // just inside 7d
        paid('2026-06-24T10:00:00Z', 200), // outside 7d, inside 30d
        paid('2026-05-01T10:00:00Z', 400), // outside 30d
      ],
      NOW,
    );
    expect(s.last7d).toEqual({ revenueThb: 100, orders: 1 });
    expect(s.last30d).toEqual({ revenueThb: 300, orders: 2 });
    expect(s.allTime).toEqual({ revenueThb: 700, orders: 3 });
  });

  it('computes all-time average order value, rounded to whole baht', () => {
    const s = summarizeSales(
      [paid('2026-07-01T18:00:00Z', 100), paid('2026-07-01T18:00:00Z', 201)],
      NOW,
    );
    expect(s.aovThb).toBe(151); // 301 / 2 → 150.5 → 151
  });

  it('counts to-ship as paid orders still pending or preparing', () => {
    const s = summarizeSales(
      [
        paid('2026-07-01T18:00:00Z', 100, 'pending'),
        paid('2026-07-01T18:00:00Z', 100, 'preparing'),
        paid('2026-07-01T18:00:00Z', 100, 'shipped'),
        paid('2026-07-01T18:00:00Z', 100, 'delivered'),
      ],
      NOW,
    );
    expect(s.toShip).toBe(2);
  });
});

describe('topProducts', () => {
  const item = (productId: string, qty: number, en: string) => ({
    productId,
    qty,
    name: { en, th: `${en}-th` },
  });

  it('aggregates quantities per product and sorts descending', () => {
    const top = topProducts([item('a', 2, 'Tote'), item('b', 5, 'Tee'), item('a', 4, 'Tote')]);
    expect(top).toEqual([
      { productId: 'a', name: { en: 'Tote', th: 'Tote-th' }, qty: 6 },
      { productId: 'b', name: { en: 'Tee', th: 'Tee-th' }, qty: 5 },
    ]);
  });

  it('limits the list', () => {
    const rows = ['a', 'b', 'c', 'd', 'e'].map((id, i) => item(id, i + 1, id));
    expect(topProducts(rows, 3)).toHaveLength(3);
    expect(topProducts(rows, 3)[0]?.productId).toBe('e');
  });
});
