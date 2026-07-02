import { Button, Text } from '@react-email/components';
import { EmailShell, type Locale, styles } from 'emails/_shell';

export interface SlipReceivedProps {
  locale: Locale;
  orderNumber: string;
  /** Token-signed link to the buyer's order page. */
  orderUrl: string;
}

const copy = {
  en: {
    preview: (n: string) => `Payment slip received for order ${n}`,
    heading: "Slip received — we're on it",
    bodyBefore: "We've received your payment slip for order ",
    bodyAfter: ". We'll confirm it shortly and email you again once verification is complete.",
    button: 'View your order',
  },
  th: {
    preview: (n: string) => `ได้รับสลิปการชำระเงินสำหรับออเดอร์ ${n} แล้ว`,
    heading: 'ได้รับสลิปแล้ว — กำลังตรวจสอบ',
    bodyBefore: 'เราได้รับสลิปการชำระเงินสำหรับออเดอร์ ',
    bodyAfter: ' แล้ว เราจะยืนยันให้เร็วที่สุด และจะส่งอีเมลแจ้งอีกครั้งเมื่อตรวจสอบเสร็จ',
    button: 'ดูออเดอร์ของคุณ',
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

/** Subject line for the slip-received email, in the buyer's language. */
export function subject(locale: Locale, orderNumber: string): string {
  return locale === 'th'
    ? `ได้รับสลิปแล้ว — ออเดอร์ ${orderNumber}`
    : `Slip received — order ${orderNumber}`;
}

export default function SlipReceived({ locale, orderNumber, orderUrl }: SlipReceivedProps) {
  const t = copy[locale];
  return (
    <EmailShell locale={locale} preview={t.preview(orderNumber)}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.paragraph}>
        {t.bodyBefore}
        <strong>{orderNumber}</strong>
        {t.bodyAfter}
      </Text>

      <Button href={orderUrl} style={styles.button}>
        {t.button}
      </Button>
    </EmailShell>
  );
}
