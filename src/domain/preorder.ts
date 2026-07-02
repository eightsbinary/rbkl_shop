export interface VariantPreorderState {
  isPreorder: boolean; // product.is_preorder
  preorderEnabled: boolean; // variant.preorder_enabled
  preorderCap: number | null;
  preorderCount: number;
  stockAvailable: number;
}

export type LineMode = 'in_stock' | 'preorder' | 'unavailable';

/** Remaining pre-order slots; Infinity when uncapped. */
export function preorderCapacity(v: { preorderCap: number | null; preorderCount: number }): number {
  if (v.preorderCap == null) return Number.POSITIVE_INFINITY;
  return Math.max(0, v.preorderCap - v.preorderCount);
}

export function acceptsPreorder(
  v: Pick<VariantPreorderState, 'isPreorder' | 'preorderEnabled'>,
): boolean {
  return v.isPreorder || v.preorderEnabled;
}

/** Whether a variant currently takes pre-orders (accepts + sold out). */
export function preorderActive(v: VariantPreorderState): boolean {
  return acceptsPreorder(v) && v.stockAvailable === 0;
}

/** How a requested qty of a variant would be fulfilled right now. */
export function lineMode(v: VariantPreorderState, qty: number): LineMode {
  if (v.stockAvailable >= qty) return 'in_stock';
  if (preorderActive(v) && qty <= preorderCapacity(v)) return 'preorder';
  return 'unavailable';
}
