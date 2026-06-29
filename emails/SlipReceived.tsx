import { Button, Text } from '@react-email/components';
import { EmailShell, styles } from 'emails/_shell';

export interface SlipReceivedProps {
  orderNumber: string;
  /** Token-signed link to the buyer's order page. */
  orderUrl: string;
}

export default function SlipReceived({ orderNumber, orderUrl }: SlipReceivedProps) {
  return (
    <EmailShell preview={`Payment slip received for order ${orderNumber}`}>
      <Text style={styles.heading}>Slip received — we're on it</Text>
      <Text style={styles.paragraph}>
        We've received your payment slip for order <strong>{orderNumber}</strong> and will confirm
        it shortly. We'll send you another email once verification is complete.
      </Text>

      <Button href={orderUrl} style={styles.button}>
        View your order
      </Button>
    </EmailShell>
  );
}
