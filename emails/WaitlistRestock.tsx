import { Button, Text } from '@react-email/components';
import { EmailShell, styles } from 'emails/_shell';

export interface WaitlistRestockProps {
  productName: string;
  /** Link to the product page where the fan can buy it. */
  productUrl: string;
}

export default function WaitlistRestock({ productName, productUrl }: WaitlistRestockProps) {
  return (
    <EmailShell preview={`${productName} is back in stock`}>
      <Text style={styles.heading}>It's back in stock</Text>
      <Text style={styles.paragraph}>
        Good news — <strong>{productName}</strong> is available again. Stock is limited, so grab
        yours before it sells out.
      </Text>

      <Button href={productUrl} style={styles.button}>
        Shop now
      </Button>
    </EmailShell>
  );
}
