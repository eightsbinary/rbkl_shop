import { Button, Text } from '@react-email/components';
import { EmailShell, type Locale, styles } from 'emails/_shell';

export interface OrderLinksProps {
  locale: Locale;
  orders: { number: string; url: string; placedAt: string }[];
}

const copy = {
  en: {
    preview: 'Links to your orders at rainbykello',
    heading: 'Your orders',
    body: 'Here are the links to your recent orders — each opens its live status page:',
    placed: 'placed',
    footer: "If you didn't request this email, you can safely ignore it.",
  },
  th: {
    preview: 'ลิงก์ออเดอร์ของคุณที่ rainbykello',
    heading: 'ออเดอร์ของคุณ',
    body: 'นี่คือลิงก์ออเดอร์ล่าสุดของคุณ — แต่ละลิงก์เปิดหน้าสถานะแบบเรียลไทม์:',
    placed: 'สั่งเมื่อ',
    footer: 'หากคุณไม่ได้ขออีเมลนี้ สามารถเพิกเฉยได้อย่างปลอดภัย',
  },
} as const satisfies Record<Locale, Record<string, unknown>>;

/** Subject line for the order-links recovery email, in the buyer's language. */
export function subject(locale: Locale): string {
  return locale === 'th' ? 'ลิงก์ออเดอร์ของคุณ — rainbykello' : 'Your order links — rainbykello';
}

export default function OrderLinks({ locale, orders }: OrderLinksProps) {
  const t = copy[locale];
  const dateLocale = locale === 'th' ? 'th-TH' : 'en-GB';
  return (
    <EmailShell locale={locale} preview={t.preview}>
      <Text style={styles.heading}>{t.heading}</Text>
      <Text style={styles.paragraph}>{t.body}</Text>

      {orders.map((o) => (
        <div key={o.number} style={{ marginBottom: 12 }}>
          <Button href={o.url} style={styles.button}>
            #{o.number}
          </Button>
          <Text style={{ ...styles.paragraph, margin: '4px 0 0' }}>
            {t.placed}{' '}
            {new Date(o.placedAt).toLocaleDateString(dateLocale, {
              dateStyle: 'medium',
            })}
          </Text>
        </div>
      ))}

      <Text style={styles.paragraph}>{t.footer}</Text>
    </EmailShell>
  );
}
