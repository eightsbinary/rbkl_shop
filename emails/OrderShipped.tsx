import { Button, Section, Text } from '@react-email/components';
import { c, EmailShell, styles } from 'emails/_shell';
import { CARRIERS } from '@/domain/carriers';

export interface OrderShippedProps {
  orderNumber: string;
  /** Carrier key from the CARRIERS registry. */
  carrier: string;
  trackingNumber: string;
  trackingUrl: string | null;
  /** Token-signed link to the buyer's order page. */
  orderUrl: string;
}

export default function OrderShipped({
  orderNumber,
  carrier,
  trackingNumber,
  trackingUrl,
  orderUrl,
}: OrderShippedProps) {
  const carrierLabel = (CARRIERS as Record<string, { label: string }>)[carrier]?.label ?? carrier;

  return (
    <EmailShell preview={`Order ${orderNumber} is on the way`}>
      <Text style={styles.heading}>Your order is on the way</Text>
      <Text style={styles.paragraph}>
        Order <strong>{orderNumber}</strong> has shipped with {carrierLabel}.
      </Text>

      <Section style={{ marginTop: '20px' }}>
        <Text style={styles.meta}>Carrier: {carrierLabel}</Text>
        <Text style={{ ...styles.meta, color: c.ink, fontWeight: 600 }}>
          Tracking: {trackingNumber}
        </Text>
      </Section>

      <Button href={trackingUrl ?? orderUrl} style={styles.button}>
        {trackingUrl ? 'Track your parcel' : 'View your order'}
      </Button>
    </EmailShell>
  );
}
