// Stale unpaid-order detection. Orders that sit in `awaiting_payment` past the
// hold window have their reserved stock released so the catalog doesn't bleed.

/** Hold window for unpaid orders before their stock reservation is released (spec §3.2). */
export const STALE_HOLD_MINUTES = 30;

export interface StaleCandidate {
  status: string;
  created_at: string;
}

/**
 * True when an order is still awaiting payment and was created longer than
 * `holdMinutes` ago. Exactly at the threshold is NOT stale — the age must exceed it.
 */
export function isStale(
  order: StaleCandidate,
  now: Date,
  holdMinutes: number = STALE_HOLD_MINUTES,
): boolean {
  if (order.status !== 'awaiting_payment') return false;
  const ageMs = now.getTime() - new Date(order.created_at).getTime();
  return ageMs > holdMinutes * 60_000;
}
