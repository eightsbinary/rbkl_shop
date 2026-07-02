// Shipping carrier registry + tracking-URL deep links.
// Owner picks a carrier from this set when marking an order shipped.

export interface Carrier {
  label: string;
  url: (trackingNumber: string) => string;
}

export const CARRIERS = {
  thailand_post: {
    label: 'Thailand Post',
    url: (n) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(n)}`,
  },
  kerry: {
    label: 'Kerry Express',
    url: (n) => `https://th.kerryexpress.com/track/?track=${encodeURIComponent(n)}`,
  },
  flash: {
    label: 'Flash Express',
    url: (n) => `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(n)}`,
  },
  jnt: {
    label: 'J&T Express',
    url: (n) =>
      `https://www.jtexpress.co.th/index/query/gzquery.html?bills=${encodeURIComponent(n)}`,
  },
  dhl: {
    label: 'DHL',
    url: (n) =>
      `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
  },
  fedex: {
    label: 'FedEx',
    url: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  },
  ups: {
    label: 'UPS',
    url: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  },
} as const satisfies Record<string, Carrier>;

export type CarrierKey = keyof typeof CARRIERS;

/** Build the carrier's tracking deep link, or null for an unknown carrier. */
export function buildTrackingUrl(key: string, trackingNumber: string): string | null {
  const carrier = (CARRIERS as Record<string, Carrier>)[key];
  return carrier ? carrier.url(trackingNumber) : null;
}
