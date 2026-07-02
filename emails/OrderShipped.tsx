import { Button, Section, Text } from '@react-email/components';
import { c, EmailShell, type Locale, styles } from 'emails/_shell';
import { CARRIERS } from '@/domain/carriers';

export interface OrderShippedProps {
  locale: Locale;
  orderNumber: string;
  /** Carrier key from the CARRIERS registry. */
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  /** Token-signed link to the buyer's order page. */
  orderUrl: string;
}

const copy = {
  en: {
    preview: (n: string) => `Order ${n} is on the way`,
    heading: 'Your order is on the way',
    orderWord: 'Order',
    shippedWith: (carrier: string) => ` has shipped with ${carrier}.`,
    carrierLabel: 'Carrier',
    trackingLabel: 'Tracking',
    track: 'Track your parcel',
    view: 'View your order',
  },
  th: {
    preview: (n: string) => `ออเดอร์ ${n} กำลังจัดส่ง`,
    heading: 'ออเดอร์ของคุณกำลังจัดส่ง',
    orderWord: 'ออเดอร์',
    shippedWith: (carrier: string) => ` จัดส่งแล้วโดย ${carrier}`,
    carrierLabel: 'ขนส่ง',
    trackingLabel: 'เลขพัสดุ',
    track: 'ติดตามพัสดุ',
    view: 'ดูออเดอร์ของคุณ',
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

/** Subject line for the shipped email, in the buyer's language. */
export function subject(locale: Locale, orderNumber: string): string {
  return locale === 'th'
    ? `ออเดอร์ ${orderNumber} กำลังจัดส่ง`
    : `Your order ${orderNumber} is on the way`;
}

export default function OrderShipped({
  locale,
  orderNumber,
  carrier,
  trackingNumber,
  trackingUrl,
  orderUrl,
}: OrderShippedProps) {
  const t = copy[locale];
  const carrierLabel = (CARRIERS as Record<string, { label: string }>)[carrier]?.label ?? carrier;

  return (
    <EmailShell locale={locale} preview={t.preview(orderNumber)}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.paragraph}>
        {t.orderWord} <strong>{orderNumber}</strong>
        {t.shippedWith(carrierLabel)}
      </Text>

      <Section style={{ marginTop: '20px' }}>
        <Text style={styles.meta}>
          {t.carrierLabel}: {carrierLabel}
        </Text>
        <Text style={{ ...styles.meta, color: c.ink, fontWeight: 600 }}>
          {t.trackingLabel}: {trackingNumber}
        </Text>
      </Section>

      <Button href={trackingUrl ?? orderUrl} style={styles.button}>
        {trackingUrl ? t.track : t.view}
      </Button>
    </EmailShell>
  );
}
