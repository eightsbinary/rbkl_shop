import { Button, Section, Text } from '@react-email/components';
import { c, EmailShell, type Locale, styles } from 'emails/_shell';

export interface OrderPaidProps {
  locale: Locale;
  orderNumber: string;
  /** Token-signed link to the buyer's order/receipt page. */
  orderUrl: string;
  items: { name: string; qty: number }[];
  totalLabel: string;
}

const copy = {
  en: {
    preview: (n: string) => `Payment received for order ${n}`,
    heading: 'Thank you — payment received',
    bodyBefore: "We've received payment for order ",
    bodyAfter: ". We'll start preparing it and email you again the moment it ships.",
    total: 'Total',
    button: 'View your order',
  },
  th: {
    preview: (n: string) => `ได้รับชำระเงินสำหรับออเดอร์ ${n} แล้ว`,
    heading: 'ขอบคุณค่ะ — ได้รับชำระเงินแล้ว',
    bodyBefore: 'เราได้รับชำระเงินสำหรับออเดอร์ ',
    bodyAfter: ' แล้ว เราจะเริ่มเตรียมพัสดุ และจะส่งอีเมลแจ้งอีกครั้งทันทีที่จัดส่ง',
    total: 'รวม',
    button: 'ดูออเดอร์ของคุณ',
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

/** Subject line for the paid-confirmation email, in the buyer's language. */
export function subject(locale: Locale, orderNumber: string): string {
  return locale === 'th'
    ? `ได้รับชำระเงินแล้ว — ออเดอร์ ${orderNumber}`
    : `Payment received — order ${orderNumber}`;
}

export default function OrderPaid({
  locale,
  orderNumber,
  orderUrl,
  items,
  totalLabel,
}: OrderPaidProps) {
  const t = copy[locale];
  return (
    <EmailShell locale={locale} preview={t.preview(orderNumber)}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.paragraph}>
        {t.bodyBefore}
        <strong>{orderNumber}</strong>
        {t.bodyAfter}
      </Text>

      <Section style={{ marginTop: '20px' }}>
        {items.map((item) => (
          <Text key={`${item.name}-${item.qty}`} style={styles.meta}>
            {item.qty} × {item.name}
          </Text>
        ))}
        <Text style={{ ...styles.meta, marginTop: '10px', color: c.ink, fontWeight: 600 }}>
          {t.total} {totalLabel}
        </Text>
      </Section>

      <Button href={orderUrl} style={styles.button}>
        {t.button}
      </Button>
    </EmailShell>
  );
}
