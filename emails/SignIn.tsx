import { Button, Text } from '@react-email/components';
import { EmailShell, styles } from 'emails/_shell';

// Admin magic-link email. Rendered to static HTML by `bun run emails:auth`
// (scripts/render-auth-emails.ts) and sent by Supabase Auth, not sendEmail —
// so it's one global template: bilingual, Thai first. The CTA href is
// Supabase's Go-template placeholder, substituted at send time.
const CONFIRMATION_URL = '{{ .ConfirmationURL }}';

const footerText =
  'คุณได้รับอีเมลนี้เพราะมีการขอลิงก์เข้าสู่ระบบด้วยอีเมลนี้ หากไม่ใช่คุณ ไม่ต้องทำอะไร · ' +
  "You received this because a sign-in link was requested for this address. If this wasn't you, ignore it.";

/** Subject for the magic-link email (set in supabase config / dashboard). */
export function subject(): string {
  return 'ลิงก์เข้าสู่ระบบ rainbykello · Your sign-in link';
}

export default function SignIn() {
  return (
    <EmailShell locale="th" preview="ลิงก์เข้าสู่ระบบของคุณ · Your sign-in link" footerText={footerText}>
      <Text style={styles.heading}>ลิงก์เข้าสู่ระบบ</Text>
      <Text style={styles.paragraph}>กดปุ่มด้านล่างเพื่อเข้าสู่ระบบหลังร้าน rainbykello</Text>
      <Text style={styles.meta}>Tap the button below to sign in to the rainbykello studio.</Text>

      <Button href={CONFIRMATION_URL} style={styles.button}>
        เข้าสู่ระบบ · Sign in
      </Button>

      <Text style={styles.meta}>ลิงก์หมดอายุใน 1 ชั่วโมง · This link expires in 1 hour.</Text>
    </EmailShell>
  );
}
