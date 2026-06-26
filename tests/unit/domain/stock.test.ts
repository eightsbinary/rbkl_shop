import { describe, expect, it } from 'vitest';
import { commitReservation, releaseReservation, reserve, type StockLevel } from '@/domain/stock';

const level = (available: number, reserved: number): StockLevel => ({
  available,
  reserved,
});

describe('reserve', () => {
  it('moves qty from available to reserved', () => {
    expect(reserve(level(10, 0), 3)).toEqual(level(7, 3));
  });

  it('throws InsufficientStock if not enough available', () => {
    expect(() => reserve(level(2, 0), 3)).toThrowError(/insufficient/i);
  });

  it('rejects non-positive qty', () => {
    expect(() => reserve(level(10, 0), 0)).toThrowError(/positive/);
    expect(() => reserve(level(10, 0), -1)).toThrowError(/positive/);
  });
});

describe('commitReservation', () => {
  it('decrements reserved (stock becomes sold)', () => {
    expect(commitReservation(level(7, 3), 2)).toEqual(level(7, 1));
  });

  it('throws if commit exceeds reserved', () => {
    expect(() => commitReservation(level(7, 3), 4)).toThrowError(/exceeds reserved/i);
  });
});

describe('releaseReservation', () => {
  it('moves qty from reserved back to available', () => {
    expect(releaseReservation(level(7, 3), 2)).toEqual(level(9, 1));
  });

  it('throws if release exceeds reserved', () => {
    expect(() => releaseReservation(level(7, 3), 4)).toThrowError(/exceeds reserved/i);
  });
});
