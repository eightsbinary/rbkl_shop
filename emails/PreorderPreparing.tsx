import { Button, Text } from '@react-email/components';
import { EmailShell, type Locale, styles } from 'emails/_shell';

export interface PreorderPreparingProps {
  locale: Locale;
  orderNumber: string;
  /** Token-signed link to the buyer's order page. */
  orderUrl: string;
}

const copy = {
  en: {
    preview: (n: string) => `Your pre-order ${n} is now being prepared`,
    heading: 'Your pre-order has arrived — packing now',
    bodyBefore: 'Good news! The items for your pre-order ',
    bodyAfter:
      " are here and we're preparing your parcel. You'll get another email with tracking as soon as it ships.",
    button: 'View your order',
  },
  th: {
    preview: (n: string) => `พรีออเดอร์ ${n} ของคุณกำลังเตรียมจัดส่ง`,
    heading: 'สินค้าพรีออเดอร์มาถึงแล้ว — กำลังแพ็กของ',
    bodyBefore: 'ข่าวดี! สินค้าสำหรับพรีออเดอร์ ',
    bodyAfter: ' มาถึงแล้ว เรากำลังเตรียมพัสดุของคุณ และจะส่งอีเมลพร้อมเลขติดตามทันทีที่จัดส่ง',
    button: 'ดูออเดอร์ของคุณ',
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

/** Subject line for the pre-order-preparing email, in the buyer's language. */
export function subject(locale: Locale, orderNumber: string): string {
  return locale === 'th'
    ? `กำลังเตรียมจัดส่ง — พรีออเดอร์ ${orderNumber}`
    : `Being prepared — pre-order ${orderNumber}`;
}

export default function PreorderPreparing({
  locale,
  orderNumber,
  orderUrl,
}: PreorderPreparingProps) {
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
