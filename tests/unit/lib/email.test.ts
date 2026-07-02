import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `server-only` throws when imported outside an RSC graph; stub it for the test.
vi.mock('server-only', () => ({}));

// Rendering React Email to HTML/text isn't under test — stub it so we can assert
// what the Gmail transport receives without depending on the render output.
vi.mock('@react-email/components', () => ({
  render: vi.fn(async (_el: unknown, opts?: { plainText?: boolean }) =>
    opts?.plainText ? 'plain text body' : '<html>hi</html>',
  ),
}));

const { smtpSend, resendSend } = vi.hoisted(() => ({ smtpSend: vi.fn(), resendSend: vi.fn() }));
vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: smtpSend }) }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: resendSend };
  },
}));

const { sendEmail } = await import('@/lib/email');

const react = React.createElement('div', null, 'hello');
const input = { to: 'fan@example.com', subject: 'Hi', react };

beforeEach(() => {
  smtpSend.mockReset();
  resendSend.mockReset();
  vi.unstubAllEnvs();
  // Start from a clean slate; individual tests opt into a provider.
  vi.stubEnv('EMAIL_PROVIDER', '');
  vi.stubEnv('RESEND_API_KEY', '');
  vi.stubEnv('GMAIL_USER', '');
  vi.stubEnv('GMAIL_APP_PASSWORD', '');
});

describe('sendEmail provider selection', () => {
  it('dry-runs when no provider is configured', async () => {
    const result = await sendEmail(input);
    expect(result).toEqual({ ok: true, dryRun: true });
    expect(smtpSend).not.toHaveBeenCalled();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('uses Gmail when only Gmail credentials are set', async () => {
    vi.stubEnv('GMAIL_USER', 'shop@gmail.com');
    vi.stubEnv('GMAIL_APP_PASSWORD', 'app-pass');
    smtpSend.mockResolvedValue({ messageId: '1' });

    const result = await sendEmail(input);
    expect(result).toEqual({ ok: true, dryRun: false });
    expect(smtpSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fan@example.com',
        subject: 'Hi',
        html: '<html>hi</html>',
        text: 'plain text body',
        from: 'rainbykello <shop@gmail.com>',
      }),
    );
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('defaults to Gmail even when a Resend key is present (switch is explicit)', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('GMAIL_USER', 'shop@gmail.com');
    vi.stubEnv('GMAIL_APP_PASSWORD', 'app-pass');
    smtpSend.mockResolvedValue({ messageId: '1' });

    await sendEmail(input);
    expect(smtpSend).toHaveBeenCalledOnce();
    expect(resendSend).not.toHaveBeenCalled();
  });

  it('switches to Resend when EMAIL_PROVIDER=resend', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('GMAIL_USER', 'shop@gmail.com');
    vi.stubEnv('GMAIL_APP_PASSWORD', 'app-pass');
    resendSend.mockResolvedValue({ error: null });

    const result = await sendEmail(input);
    expect(result).toEqual({ ok: true, dryRun: false });
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'fan@example.com', subject: 'Hi', react }),
    );
    expect(smtpSend).not.toHaveBeenCalled();
  });

  it('surfaces a Gmail SMTP failure', async () => {
    vi.stubEnv('GMAIL_USER', 'shop@gmail.com');
    vi.stubEnv('GMAIL_APP_PASSWORD', 'app-pass');
    smtpSend.mockRejectedValue(new Error('smtp down'));
    const result = await sendEmail(input);
    expect(result).toEqual({ ok: false, error: 'smtp down' });
  });

  it('surfaces a Resend failure', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    resendSend.mockResolvedValue({ error: { message: 'rate limited' } });
    const result = await sendEmail(input);
    expect(result).toEqual({ ok: false, error: 'rate limited' });
  });
});
