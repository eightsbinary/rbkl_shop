import type { ChargeHandle, ChargeInput, ChargeStatus, VerifiedEvent } from './ChargeInput';

/**
 * PSP-agnostic payment interface. Adapters live under ./adapters/.
 * Swapping providers is a one-file change: implement this interface,
 * register the adapter key, and update the notify-url path.
 */
export interface PaymentProvider {
  readonly key: string;
  createCharge(input: ChargeInput): Promise<ChargeHandle>;
  verifyNotification(req: Request): Promise<VerifiedEvent>;
  reconcile(chargeId: string): Promise<ChargeStatus>;
}
