import { Button, Section, Text } from '@react-email/components';
import { c, EmailShell, styles } from 'emails/_shell';

export interface OrderPaidProps {
  orderNumber: string;
  /** Token-signed link to the buyer's order/receipt page. */
  orderUrl: string;
  items: { name: string; qty: number }[];
  totalLabel: string;
}

export default function OrderPaid({ orderNumber, orderUrl, items, totalLabel }: OrderPaidProps) {
  return (
    <EmailShell preview={`Payment received for order ${orderNumber}`}>
      <Text style={styles.heading}>Thank you — payment received</Text>
      <Text style={styles.paragraph}>
        We've received payment for order <strong>{orderNumber}</strong>. We'll start preparing it
        and email you again the moment it ships.
      </Text>

      <Section style={{ marginTop: '20px' }}>
        {items.map((item) => (
          <Text key={`${item.name}-${item.qty}`} style={styles.meta}>
            {item.qty} × {item.name}
          </Text>
        ))}
        <Text style={{ ...styles.meta, marginTop: '10px', color: c.ink, fontWeight: 600 }}>
          Total {totalLabel}
        </Text>
      </Section>

      <Button href={orderUrl} style={styles.button}>
        View your order
      </Button>
    </EmailShell>
  );
}
