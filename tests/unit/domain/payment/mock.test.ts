import { describe, expect, it } from 'vitest';
import { MockProvider, signMockEvent } from '@/domain/payment/adapters/MockProvider';

const provider = new MockProvider();

describe('MockProvider', () => {
  it('creates a charge with a redirect URL containing the order id', async () => {
    const handle = await provider.createCharge({
      orderId: 'o1',
      orderNumber: 'AAA',
      amountThb: 100,
      currency: 'THB',
      method: 'mock',
      returnUrl: 'http://x/return',
      notifyUrl: 'http://x/notify',
      customerEmail: 'a@b.c',
    });
    expect(handle.chargeId).toMatch(/^mock_/);
    expect(handle.redirectUrl).toContain('o1');
  });

  it('verifies a valid signed notification', async () => {
    const body = JSON.stringify({
      eventId: 'evt-1',
      orderId: 'o1',
      chargeId: 'mock_c1',
      status: 'paid',
      amountThb: 100,
      occurredAt: Date.now(),
    });
    const sig = signMockEvent(body);
    const req = new Request('http://x', {
      method: 'POST',
      body,
      headers: { 'x-mock-signature': sig },
    });
    const ev = await provider.verifyNotification(req);
    expect(ev.status).toBe('paid');
    expect(ev.orderId).toBe('o1');
    expect(ev.amountThb).toBe(100);
    expect(typeof ev.occurredAt).toBe('number');
  });

  it('rejects notifications with no signature', async () => {
    const req = new Request('http://x', { method: 'POST', body: '{}' });
    await expect(provider.verifyNotification(req)).rejects.toThrow(/signature/i);
  });

  it('rejects notifications with a bad signature', async () => {
    const req = new Request('http://x', {
      method: 'POST',
      body: '{}',
      headers: { 'x-mock-signature': 'bogus' },
    });
    await expect(provider.verifyNotification(req)).rejects.toThrow(/signature/i);
  });
});
