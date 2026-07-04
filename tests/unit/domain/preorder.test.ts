import { describe, expect, it } from 'vitest';
import { lineMode, preorderCapacity, waitlistAvailability } from '@/domain/preorder';

const variant = (over: Partial<Parameters<typeof lineMode>[0]> = {}) => ({
  isPreorder: false,
  preorderEnabled: false,
  preorderCap: null as number | null,
  preorderCount: 0,
  stockAvailable: 0,
  ...over,
});

describe('lineMode', () => {
  it('sells from stock when available', () => {
    expect(lineMode(variant({ stockAvailable: 5 }), 3)).toBe('in_stock');
  });
  it('is unavailable when sold out and not pre-orderable', () => {
    expect(lineMode(variant({ stockAvailable: 0 }), 1)).toBe('unavailable');
  });
  it('pre-orders a sold-out variant flagged preorderEnabled (oversell)', () => {
    expect(lineMode(variant({ stockAvailable: 0, preorderEnabled: true }), 2)).toBe('preorder');
  });
  it('pre-orders a sold-out drop product', () => {
    expect(lineMode(variant({ stockAvailable: 0, isPreorder: true }), 2)).toBe('preorder');
  });
  it('blocks pre-order beyond the cap', () => {
    expect(lineMode(variant({ preorderEnabled: true, preorderCap: 5, preorderCount: 4 }), 2)).toBe(
      'unavailable',
    );
    expect(lineMode(variant({ preorderEnabled: true, preorderCap: 5, preorderCount: 4 }), 1)).toBe(
      'preorder',
    );
  });
  it('treats null cap as unlimited', () => {
    expect(
      lineMode(variant({ preorderEnabled: true, preorderCap: null, preorderCount: 9999 }), 50),
    ).toBe('preorder');
  });
});

describe('preorderCapacity', () => {
  it('is Infinity for a null cap', () => {
    expect(preorderCapacity({ preorderCap: null, preorderCount: 3 })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
  it('is the remaining slots for a set cap', () => {
    expect(preorderCapacity({ preorderCap: 10, preorderCount: 7 })).toBe(3);
    expect(preorderCapacity({ preorderCap: 10, preorderCount: 12 })).toBe(0);
  });
});

describe('waitlistAvailability', () => {
  it('reports in_stock when real stock exists', () => {
    expect(waitlistAvailability(variant({ stockAvailable: 3 }))).toBe('in_stock');
  });
  it('reports preorder when sold out but pre-order capacity is open', () => {
    expect(
      waitlistAvailability(variant({ preorderEnabled: true, preorderCap: 5, preorderCount: 2 })),
    ).toBe('preorder');
    expect(waitlistAvailability(variant({ isPreorder: true }))).toBe('preorder');
  });
  it('reports null when sold out with pre-orders full', () => {
    expect(
      waitlistAvailability(variant({ preorderEnabled: true, preorderCap: 5, preorderCount: 5 })),
    ).toBeNull();
  });
  it('reports null when sold out and not pre-orderable', () => {
    expect(waitlistAvailability(variant())).toBeNull();
  });
  it('prefers in_stock over preorder when both apply', () => {
    expect(waitlistAvailability(variant({ stockAvailable: 1, preorderEnabled: true }))).toBe(
      'in_stock',
    );
  });
});
