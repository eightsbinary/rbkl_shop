import { Button, Text } from '@react-email/components';
import { EmailShell, type Locale, styles } from 'emails/_shell';

export interface SlipRejectedProps {
  locale: Locale;
  orderNumber: string;
  /** Token-signed link to the buyer's order page to re-upload. */
  orderUrl: string;
  /** Admin-entered reason — shown verbatim, not translated. */
  reason: string;
}

const copy = {
  en: {
    preview: (n: string) => `Action needed — payment slip for order ${n}`,
    heading: "We couldn't verify your payment slip",
    bodyBefore: "We couldn't verify your payment slip for order ",
    bodyAfter: '.',
    button: 'Re-upload your slip',
  },
  th: {
    preview: (n: string) => `ต้องดำเนินการ — สลิปการชำระเงินสำหรับออเดอร์ ${n}`,
    heading: 'เราไม่สามารถยืนยันสลิปของคุณได้',
    bodyBefore: 'เราไม่สามารถยืนยันสลิปการชำระเงินสำหรับออเดอร์ ',
    bodyAfter: ' ได้',
    button: 'อัปโหลดสลิปใหม่',
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

/** Subject line for the slip-rejected email, in the buyer's language. */
export function subject(locale: Locale, orderNumber: string): string {
  return locale === 'th'
    ? `ต้องดำเนินการ — ออเดอร์ ${orderNumber}`
    : `Action needed — order ${orderNumber}`;
}

export default function SlipRejected({ locale, orderNumber, orderUrl, reason }: SlipRejectedProps) {
  const t = copy[locale];
  return (
    <EmailShell locale={locale} preview={t.preview(orderNumber)}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.paragraph}>
        {t.bodyBefore}
        <strong>{orderNumber}</strong>
        {t.bodyAfter}
      </Text>
      <Text style={styles.paragraph}>{reason}</Text>

      <Button href={orderUrl} style={styles.button}>
        {t.button}
      </Button>
    </EmailShell>
  );
}
