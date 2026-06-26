import { describe, expect, it } from 'vitest';
import { generateOrderNumber, isValidOrderNumber } from '@/domain/order-number';

describe('order-number', () => {
  it('returns a 12-char string from the Crockford alphabet', () => {
    const n = generateOrderNumber();
    expect(n).toHaveLength(12);
    expect(/^[0-9ABCDEFGHJKMNPQRSTVWXYZ]{12}$/.test(n)).toBe(true);
  });

  it('round-trips: generated numbers pass validation', () => {
    for (let i = 0; i < 50; i++) {
      expect(isValidOrderNumber(generateOrderNumber())).toBe(true);
    }
  });

  it('rejects tampered numbers (single char swap in payload)', () => {
    const n = generateOrderNumber();
    const swapChar = (n[5] ?? '0') === '0' ? '1' : '0';
    const swapped = `${n.slice(0, 5)}${swapChar}${n.slice(6)}`;
    expect(isValidOrderNumber(swapped)).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isValidOrderNumber('TOO-SHORT')).toBe(false);
    expect(isValidOrderNumber('OOOOOOOOOOOO')).toBe(false);
  });
});
