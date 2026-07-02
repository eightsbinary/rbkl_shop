import { describe, expect, it } from 'vitest';
import { isStale, STALE_HOLD_MINUTES } from '@/domain/stale-orders';

const now = new Date('2026-06-27T12:00:00Z');
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

describe('STALE_HOLD_MINUTES', () => {
  it('is 30 minutes (spec §3.2)', () => {
    expect(STALE_HOLD_MINUTES).toBe(30);
  });
});

describe('isStale', () => {
  it('is true for an awaiting_payment order older than the threshold', () => {
    expect(isStale({ status: 'awaiting_payment', created_at: minsAgo(31) }, now)).toBe(true);
  });

  it('is false for an awaiting_payment order younger than the threshold', () => {
    expect(isStale({ status: 'awaiting_payment', created_at: minsAgo(10) }, now)).toBe(false);
  });

  it('is false at exactly the threshold (must exceed it)', () => {
    expect(isStale({ status: 'awaiting_payment', created_at: minsAgo(30) }, now)).toBe(false);
  });

  it('ignores non-awaiting_payment statuses even when old', () => {
    expect(isStale({ status: 'paid', created_at: minsAgo(120) }, now)).toBe(false);
    expect(isStale({ status: 'cancelled', created_at: minsAgo(120) }, now)).toBe(false);
  });

  it('honours a custom hold window', () => {
    const order = { status: 'awaiting_payment', created_at: minsAgo(15) };
    expect(isStale(order, now, 10)).toBe(true);
    expect(isStale(order, now, 20)).toBe(false);
  });
});
