import { addMoney, type Money, multiplyMoney, subtractMoney, ZERO_THB } from './money';

export interface LineItem {
  readonly variantId: string;
  readonly unitPrice: Money;
  readonly qty: number;
}

export interface Totals {
  readonly subtotal: Money;
  readonly discount: Money;
  readonly shipping: Money;
  readonly total: Money;
}

export interface ComputeTotalsInput {
  readonly lines: ReadonlyArray<LineItem>;
  readonly discount: Money;
  readonly shipping: Money;
}

export function computeTotals(input: ComputeTotalsInput): Totals {
  const subtotal = input.lines.reduce<Money>((acc, line) => {
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      throw new Error('LineItem qty must be a positive integer');
    }
    return addMoney(acc, multiplyMoney(line.unitPrice, line.qty));
  }, ZERO_THB);

  // Clamp discount to subtotal so total can never go negative.
  const effectiveDiscount = input.discount.amount > subtotal.amount ? subtotal : input.discount;

  const afterDiscount = subtractMoney(subtotal, effectiveDiscount);
  const total = addMoney(afterDiscount, input.shipping);

  return {
    subtotal,
    discount: effectiveDiscount,
    shipping: input.shipping,
    total,
  };
}
