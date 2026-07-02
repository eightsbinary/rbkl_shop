import { describe, expect, it } from 'vitest';
import { money, ZERO_THB } from '@/domain/money';
import { computeTotals, type LineItem } from '@/domain/pricing';

const lines: LineItem[] = [
  { variantId: 'v1', unitPrice: money(590), qty: 2 },
  { variantId: 'v2', unitPrice: money(1290), qty: 1 },
];

describe('computeTotals', () => {
  it('computes subtotal from line items', () => {
    const t = computeTotals({ lines, discount: ZERO_THB, shipping: ZERO_THB });
    expect(t.subtotal).toEqual(money(2470));
    expect(t.discount).toEqual(ZERO_THB);
    expect(t.shipping).toEqual(ZERO_THB);
    expect(t.total).toEqual(money(2470));
  });

  it('applies discount before shipping', () => {
    const t = computeTotals({ lines, discount: money(200), shipping: money(60) });
    expect(t.subtotal).toEqual(money(2470));
    expect(t.discount).toEqual(money(200));
    expect(t.shipping).toEqual(money(60));
    expect(t.total).toEqual(money(2330));
  });

  it('clamps discount to subtotal so total never negative', () => {
    const t = computeTotals({ lines, discount: money(99999), shipping: money(60) });
    expect(t.discount).toEqual(money(2470));
    expect(t.total).toEqual(money(60));
  });

  it('returns zero totals for empty cart', () => {
    const t = computeTotals({ lines: [], discount: ZERO_THB, shipping: ZERO_THB });
    expect(t.subtotal).toEqual(ZERO_THB);
    expect(t.total).toEqual(ZERO_THB);
  });

  it('rejects non-positive qty', () => {
    expect(() =>
      computeTotals({
        lines: [{ variantId: 'v1', unitPrice: money(10), qty: 0 }],
        discount: ZERO_THB,
        shipping: ZERO_THB,
      }),
    ).toThrowError(/positive/);
  });
});
