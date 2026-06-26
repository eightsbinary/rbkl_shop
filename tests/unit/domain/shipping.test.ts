import { describe, expect, it } from 'vitest';
import { money } from '@/domain/money';
import { computeShippingCost, type ShippingZone } from '@/domain/shipping';

const zones: ShippingZone[] = [
  { code: 'TH', name: 'Thailand', countries: ['TH'], flatRateBaht: 60, isActive: true },
  {
    code: 'SEA',
    name: 'Southeast Asia',
    countries: ['MY', 'SG', 'ID', 'VN', 'PH'],
    flatRateBaht: 280,
    isActive: true,
  },
  { code: 'WW', name: 'Worldwide', countries: ['*'], flatRateBaht: 650, isActive: true },
];

describe('computeShippingCost', () => {
  it('selects domestic zone by country code', () => {
    expect(computeShippingCost('TH', zones)).toEqual({
      zone: zones[0],
      cost: money(60),
    });
  });

  it('selects SEA zone for SEA country', () => {
    expect(computeShippingCost('SG', zones)).toEqual({
      zone: zones[1],
      cost: money(280),
    });
  });

  it('falls back to worldwide wildcard', () => {
    expect(computeShippingCost('US', zones)).toEqual({
      zone: zones[2],
      cost: money(650),
    });
  });

  it('throws when no zone matches and no wildcard exists', () => {
    const noWildcard = zones.slice(0, 2);
    expect(() => computeShippingCost('US', noWildcard)).toThrowError(/no shipping zone/i);
  });

  it('ignores inactive zones', () => {
    const [first, second, third] = zones;
    if (!first || !second || !third) throw new Error('zones must have 3 entries');
    const thInactive = [{ ...first, isActive: false }, second, third];
    expect(computeShippingCost('TH', thInactive)).toEqual({
      zone: third,
      cost: money(650),
    });
  });
});
