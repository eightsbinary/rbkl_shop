import { describe, expect, it } from 'vitest';
import { ShippingZonesSchema } from '@/domain/shipping-zones';

const valid = {
  code: 'TH',
  name: { en: 'Thailand' },
  countries: ['TH'],
  flatRateThb: 60,
  isActive: true,
};

describe('ShippingZonesSchema', () => {
  it('accepts a valid set', () => {
    expect(ShippingZonesSchema.safeParse([valid]).success).toBe(true);
  });

  it('accepts the worldwide wildcard', () => {
    expect(
      ShippingZonesSchema.safeParse([{ ...valid, code: 'WW', countries: ['*'] }]).success,
    ).toBe(true);
  });

  it('rejects an empty countries list', () => {
    expect(ShippingZonesSchema.safeParse([{ ...valid, countries: [] }]).success).toBe(false);
  });

  it('rejects a negative rate', () => {
    expect(ShippingZonesSchema.safeParse([{ ...valid, flatRateThb: -1 }]).success).toBe(false);
  });

  it('rejects a non-integer rate', () => {
    expect(ShippingZonesSchema.safeParse([{ ...valid, flatRateThb: 5.5 }]).success).toBe(false);
  });

  it('rejects a blank code', () => {
    expect(ShippingZonesSchema.safeParse([{ ...valid, code: '' }]).success).toBe(false);
  });

  it('rejects a code with spaces or symbols', () => {
    expect(ShippingZonesSchema.safeParse([{ ...valid, code: 'T H' }]).success).toBe(false);
  });

  it('rejects duplicate codes (case-insensitive)', () => {
    expect(ShippingZonesSchema.safeParse([valid, { ...valid, code: 'th' }]).success).toBe(false);
  });
});
