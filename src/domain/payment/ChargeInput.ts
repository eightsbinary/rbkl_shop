export type PaymentMethodKind = 'card' | 'promptpay' | 'mobile_banking' | 'mock';

export interface ChargeInput {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly amountThb: number;
  readonly currency: 'THB';
  readonly method: PaymentMethodKind;
  readonly returnUrl: string;
  readonly notifyUrl: string;
  readonly customerEmail: string;
}

export interface ChargeHandle {
  readonly chargeId: string;
  readonly redirectUrl?: string;
  readonly qrPayload?: string;
}

export type ChargeStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface VerifiedEvent {
  readonly eventId: string;
  readonly orderId: string;
  readonly chargeId: string;
  readonly status: ChargeStatus;
  readonly amountThb: number;
  readonly occurredAt: number;
}
