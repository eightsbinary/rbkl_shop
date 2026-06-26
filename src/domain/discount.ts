import { fromSatang, type Money, money } from './money';

export interface DiscountCode {
  readonly code: string;
  readonly kind: 'fixed' | 'percent';
  readonly value: number; // baht (fixed) OR 0-100 (percent)
  readonly minSubtotalBaht: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly maxUses: number | null;
  readonly uses: number;
  readonly active: boolean;
}

export type DiscountResult =
  | { ok: true; amount: Money }
  | { ok: false; reason: 'inactive' | 'expired' | 'min_subtotal' | 'max_uses' };

export function applyDiscount(code: DiscountCode, subtotal: Money, now: Date): DiscountResult {
  if (!code.active) return { ok: false, reason: 'inactive' };
  if (now < code.startsAt || now > code.endsAt) return { ok: false, reason: 'expired' };

  const subtotalBaht = subtotal.amount / 100;
  if (subtotalBaht < code.minSubtotalBaht) return { ok: false, reason: 'min_subtotal' };

  if (code.maxUses !== null && code.uses >= code.maxUses) {
    return { ok: false, reason: 'max_uses' };
  }

  if (code.kind === 'fixed') {
    return { ok: true, amount: money(code.value) };
  }

  const amount = Math.floor((subtotal.amount * code.value) / 100);
  return { ok: true, amount: fromSatang(amount) };
}
