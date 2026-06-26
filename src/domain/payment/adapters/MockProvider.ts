import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { ChargeHandle, ChargeInput, ChargeStatus, VerifiedEvent } from '../ChargeInput';
import type { PaymentProvider } from '../PaymentProvider';

const MOCK_SECRET = process.env.RB_SHOP_MOCK_SECRET ?? 'dev-mock-secret';

export function signMockEvent(body: string): string {
  return createHmac('sha256', MOCK_SECRET).update(body).digest('base64url');
}

/**
 * Dev-only payment provider. Hard-disabled in production unless explicitly
 * overridden via RB_SHOP_ALLOW_MOCK=1. The simulator UI pings the notify
 * endpoint directly; reconcile() returns 'pending' since the mock has no
 * out-of-band state.
 */
export class MockProvider implements PaymentProvider {
  readonly key = 'mock';

  constructor() {
    if (process.env.NODE_ENV === 'production' && !process.env.RB_SHOP_ALLOW_MOCK) {
      throw new Error('MockProvider is disabled in production');
    }
  }

  async createCharge(input: ChargeInput): Promise<ChargeHandle> {
    const chargeId = `mock_${randomBytes(8).toString('hex')}`;
    return {
      chargeId,
      redirectUrl: `/checkout/pay/${input.orderId}?cid=${chargeId}`,
    };
  }

  async verifyNotification(req: Request): Promise<VerifiedEvent> {
    const sig = req.headers.get('x-mock-signature');
    if (!sig) throw new Error('Missing signature');
    const body = await req.text();
    const expected = signMockEvent(body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('Invalid signature');
    }
    return JSON.parse(body) as VerifiedEvent;
  }

  async reconcile(_chargeId: string): Promise<ChargeStatus> {
    return 'pending';
  }
}
