import { beforeEach, describe, expect, it } from 'vitest';
import { signOrderToken, verifyOrderToken } from '@/lib/order-token';

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key-please-change';
});

describe('order-token', () => {
  it('signs and verifies a token bound to (orderId, email)', () => {
    const token = signOrderToken('order-1', 'fan@example.com');
    expect(verifyOrderToken(token, 'order-1', 'fan@example.com')).toBe(true);
  });

  it('rejects token bound to a different email', () => {
    const token = signOrderToken('order-1', 'fan@example.com');
    expect(verifyOrderToken(token, 'order-1', 'someone@else.com')).toBe(false);
  });

  it('rejects token bound to a different order', () => {
    const token = signOrderToken('order-1', 'fan@example.com');
    expect(verifyOrderToken(token, 'order-2', 'fan@example.com')).toBe(false);
  });

  it('treats email case-insensitively when verifying', () => {
    const token = signOrderToken('order-1', 'Fan@Example.COM');
    expect(verifyOrderToken(token, 'order-1', 'fan@example.com')).toBe(true);
  });

  it('rejects malformed tokens', () => {
    expect(verifyOrderToken('not-a-token', 'order-1', 'fan@example.com')).toBe(false);
    expect(verifyOrderToken('aaa.bbb.ccc', 'order-1', 'fan@example.com')).toBe(false);
  });
});
