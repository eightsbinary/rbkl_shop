import { Button, Text } from '@react-email/components';
import { EmailShell, type Locale, styles } from 'emails/_shell';

export type WaitlistMode = 'restock' | 'preorder';

export interface WaitlistRestockProps {
  locale: Locale;
  productName: string;
  /** Link to the product page where the fan can buy it. */
  productUrl: string;
  /** What became available: real stock (default) or open pre-order slots. */
  mode?: WaitlistMode;
}

const copy = {
  en: {
    restock: {
      preview: (name: string) => `${name} is back in stock`,
      heading: "It's back in stock",
      bodyAfter: ' is available again. Stock is limited, so grab yours before it sells out.',
      button: 'Shop now',
    },
    preorder: {
      preview: (name: string) => `${name} is open for pre-order`,
      heading: 'Pre-orders are open',
      bodyAfter:
        ' is now open for pre-order. Slots are limited, so reserve yours before they fill up.',
      button: 'Pre-order now',
    },
  },
  th: {
    restock: {
      preview: (name: string) => `${name} กลับมาแล้ว`,
      heading: 'สินค้ากลับมาแล้ว',
      bodyAfter: ' กลับมาวางขายอีกครั้งแล้ว สินค้ามีจำนวนจำกัด รีบสั่งก่อนของหมดนะคะ',
      button: 'ช้อปเลย',
    },
    preorder: {
      preview: (name: string) => `${name} เปิดพรีออเดอร์แล้ว`,
      heading: 'เปิดพรีออเดอร์แล้ว',
      bodyAfter: ' เปิดให้พรีออเดอร์แล้ว จำนวนจำกัด รีบจองก่อนเต็มนะคะ',
      button: 'พรีออเดอร์เลย',
    },
  },
} as const satisfies Record<Locale, Record<WaitlistMode, Record<string, unknown>>>;

/** Subject line for the waitlist notification, in the buyer's language. */
export function subject(
  locale: Locale,
  productName: string,
  mode: WaitlistMode = 'restock',
): string {
  if (mode === 'preorder') {
    return locale === 'th'
      ? `${productName} เปิดพรีออเดอร์แล้ว`
      : `${productName} is open for pre-order`;
  }
  return locale === 'th' ? `${productName} กลับมาแล้ว` : `${productName} is back in stock`;
}

export default function WaitlistRestock({
  locale,
  productName,
  productUrl,
  mode = 'restock',
}: WaitlistRestockProps) {
  const t = copy[locale][mode];
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
