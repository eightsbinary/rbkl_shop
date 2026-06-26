import { type Money, money } from './money';

export interface ShippingZone {
  readonly code: string;
  readonly name: string;
  readonly countries: ReadonlyArray<string>; // ISO-3166 alpha-2 codes, or ['*'] for worldwide fallback
  readonly flatRateBaht: number;
  readonly isActive: boolean;
}

export interface ShippingQuote {
  readonly zone: ShippingZone;
  readonly cost: Money;
}

export function computeShippingCost(
  countryCode: string,
  zones: ReadonlyArray<ShippingZone>,
): ShippingQuote {
  const active = zones.filter((z) => z.isActive);
  const specific = active.find((z) => z.countries.includes(countryCode));
  const matched = specific ?? active.find((z) => z.countries.includes('*'));
  if (!matched) {
    throw new Error(`No shipping zone matches country ${countryCode}`);
  }
  return { zone: matched, cost: money(matched.flatRateBaht) };
}
