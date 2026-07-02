import { describe, expect, it } from 'vitest';
import { addMoney, formatMoney, money, multiplyMoney, subtractMoney } from '@/domain/money';

describe('money', () => {
  it('constructs from baht', () => {
    expect(money(100)).toEqual({ amount: 10000, currency: 'THB' });
  });

  it('rejects negative construction', () => {
    expect(() => money(-1)).toThrowError(/non-negative/);
  });

  it('rejects more than two decimal places', () => {
    expect(() => money(10.005)).toThrowError(/two decimal/);
  });

  it('adds money of the same currency', () => {
    expect(addMoney(money(10), money(5))).toEqual(money(15));
  });

  it('refuses to add mismatched currencies', () => {
    const usd = { amount: 100, currency: 'USD' as const };
    expect(() => addMoney(money(10), usd as never)).toThrowError(/currency/i);
  });

  it('subtracts and clamps at zero', () => {
    expect(subtractMoney(money(10), money(3))).toEqual(money(7));
    expect(subtractMoney(money(3), money(10))).toEqual(money(0));
  });

  it('multiplies by integer quantity', () => {
    expect(multiplyMoney(money(7.5), 3)).toEqual(money(22.5));
  });

  it('rejects negative or fractional quantity', () => {
    expect(() => multiplyMoney(money(10), -1)).toThrowError(/non-negative integer/);
    expect(() => multiplyMoney(money(10), 1.5)).toThrowError(/non-negative integer/);
  });

  it('formats THB for th locale', () => {
    expect(formatMoney(money(1290), 'th')).toBe('฿1,290.00');
  });

  it('formats THB for en locale', () => {
    expect(formatMoney(money(1290), 'en')).toBe('฿1,290.00');
  });
});
