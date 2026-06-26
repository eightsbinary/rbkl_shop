import { describe, expect, it } from 'vitest';
import { applyDiscount, type DiscountCode } from '@/domain/discount';
import { money } from '@/domain/money';

const fixedCode: DiscountCode = {
  code: 'WELCOME50',
  kind: 'fixed',
  value: 50,
  minSubtotalBaht: 0,
  startsAt: new Date('2026-01-01T00:00:00Z'),
  endsAt: new Date('2027-01-01T00:00:00Z'),
  maxUses: null,
  uses: 0,
  active: true,
};

const percentCode: DiscountCode = {
  ...fixedCode,
  code: 'TEN',
  kind: 'percent',
  value: 10,
};

const now = new Date('2026-06-26T12:00:00Z');

describe('applyDiscount', () => {
  it('returns fixed discount amount as Money', () => {
    const r = applyDiscount(fixedCode, money(500), now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toEqual(money(50));
  });

  it('returns percent discount amount as Money', () => {
    const r = applyDiscount(percentCode, money(500), now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toEqual(money(50));
  });

  it('floors percent discount to satang', () => {
    const r = applyDiscount(percentCode, money(133.33), now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount.amount).toBe(1333);
  });

  it('rejects inactive codes', () => {
    const r = applyDiscount({ ...fixedCode, active: false }, money(500), now);
    expect(r).toEqual({ ok: false, reason: 'inactive' });
  });

  it('rejects codes outside time window', () => {
    const r = applyDiscount(fixedCode, money(500), new Date('2025-12-31T00:00:00Z'));
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects when subtotal below minimum', () => {
    const r = applyDiscount({ ...fixedCode, minSubtotalBaht: 1000 }, money(500), now);
    expect(r).toEqual({ ok: false, reason: 'min_subtotal' });
  });

  it('rejects when max uses reached', () => {
    const r = applyDiscount({ ...fixedCode, maxUses: 5, uses: 5 }, money(500), now);
    expect(r).toEqual({ ok: false, reason: 'max_uses' });
  });

  it('returns fixed amount untouched even when over subtotal (caller clamps)', () => {
    const r = applyDiscount({ ...fixedCode, value: 1000 }, money(500), now);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.amount).toEqual(money(1000));
  });
});
