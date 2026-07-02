import { render } from '@react-email/components';
import SignIn, { subject } from 'emails/SignIn';
import { describe, expect, it } from 'vitest';

describe('SignIn email', () => {
  it('keeps the Supabase Go-template placeholder intact in the CTA href', async () => {
    const html = await render(SignIn());
    // Must survive rendering EXACTLY — an URL-encoded `%7B%7B` href would make
    // Supabase send a literal broken link.
    expect(html).toContain('href="{{ .ConfirmationURL }}"');
  });

  it('is bilingual — Thai first with English support copy', async () => {
    const html = await render(SignIn());
    expect(html).toContain('ลิงก์เข้าสู่ระบบ');
    expect(html).toContain('Sign in');
    expect(html).toContain('rainbykello');
  });

  it('uses an auth-specific footer, not the order footer', async () => {
    const html = await render(SignIn());
    expect(html).not.toContain('placed an order');
    expect(html).not.toContain('สั่งซื้อสินค้า');
    expect(html).toContain('หากไม่ใช่คุณ');
  });

  it('mentions the 1-hour expiry', async () => {
    const html = await render(SignIn());
    expect(html).toContain('1 ชั่วโมง');
    expect(html).toContain('1 hour');
  });

  it('has a bilingual subject', () => {
    expect(subject()).toContain('เข้าสู่ระบบ');
    expect(subject().toLowerCase()).toContain('sign-in');
  });
});
