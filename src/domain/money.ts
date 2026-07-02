export type Currency = 'THB';

export interface Money {
  readonly amount: number; // integer minor units (satang)
  readonly currency: Currency;
}

export function money(baht: number, currency: Currency = 'THB'): Money {
  if (baht < 0) throw new Error('Money must be non-negative');
  const satang = Math.round(baht * 100);
  if (Math.abs(satang / 100 - baht) > 1e-9) {
    throw new Error('Money supports at most two decimal places');
  }
  return { amount: satang, currency };
}

export function fromSatang(amount: number, currency: Currency = 'THB'): Money {
  if (!Number.isInteger(amount)) throw new Error('satang must be an integer');
  if (amount < 0) throw new Error('Money must be non-negative');
  return { amount, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: Math.max(0, a.amount - b.amount), currency: a.currency };
}

export function multiplyMoney(a: Money, qty: number): Money {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error('multiplyMoney qty must be a non-negative integer');
  }
  return { amount: a.amount * qty, currency: a.currency };
}

export function formatMoney(m: Money, locale: 'th' | 'en'): string {
  const fmt = new Intl.NumberFormat(locale === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency',
    currency: m.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return fmt.format(m.amount / 100);
}

export const ZERO_THB: Money = { amount: 0, currency: 'THB' };
