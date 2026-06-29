import { Button, Text } from '@react-email/components';
import { EmailShell, styles } from 'emails/_shell';

export interface SlipRejectedProps {
  orderNumber: string;
  /** Token-signed link to the buyer's order page to re-upload. */
  orderUrl: string;
  reason: string;
}

export default function SlipRejected({ orderNumber, orderUrl, reason }: SlipRejectedProps) {
  return (
    <EmailShell preview={`Action needed — payment slip for order ${orderNumber}`}>
      <Text style={styles.heading}>We couldn't verify your payment slip</Text>
      <Text style={styles.paragraph}>
        We couldn't verify your payment slip for order <strong>{orderNumber}</strong>.
      </Text>
      <Text style={styles.paragraph}>{reason}</Text>

      <Button href={orderUrl} style={styles.button}>
        Re-upload your slip
      </Button>
    </EmailShell>
  );
}
