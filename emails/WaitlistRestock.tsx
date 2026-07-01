import { Button, Text } from '@react-email/components';
import { EmailShell, type Locale, styles } from 'emails/_shell';

export interface WaitlistRestockProps {
  locale: Locale;
  productName: string;
  /** Link to the product page where the fan can buy it. */
  productUrl: string;
}

const copy = {
  en: {
    preview: (name: string) => `${name} is back in stock`,
    heading: "It's back in stock",
    bodyAfter: ' is available again. Stock is limited, so grab yours before it sells out.',
    button: 'Shop now',
  },
  th: {
    preview: (name: string) => `${name} กลับมาแล้ว`,
    heading: 'สินค้ากลับมาแล้ว',
    bodyAfter: ' กลับมาวางขายอีกครั้งแล้ว สินค้ามีจำนวนจำกัด รีบสั่งก่อนของหมดนะคะ',
    button: 'ช้อปเลย',
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

/** Subject line for the restock email, in the buyer's language. */
export function subject(locale: Locale, productName: string): string {
  return locale === 'th' ? `${productName} กลับมาแล้ว` : `${productName} is back in stock`;
}

export default function WaitlistRestock({ locale, productName, productUrl }: WaitlistRestockProps) {
  const t = copy[locale];
  return (
    <EmailShell locale={locale} preview={t.preview(productName)}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.paragraph}>
        <strong>{productName}</strong>
        {t.bodyAfter}
      </Text>

      <Button href={productUrl} style={styles.button}>
        {t.button}
      </Button>
    </EmailShell>
  );
}
