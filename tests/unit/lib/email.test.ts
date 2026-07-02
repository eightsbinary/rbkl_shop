import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `server-only` throws when imported outside an RSC graph; stub it for the test.
vi.mock('server-only', () => ({}));

// Rendering React Email to HTML/text isn't under test here — stub it so we can
// assert what the transport receives without depending on the render output.
vi.mock('@react-email/components', () => ({
  render: vi.fn(async (_el: unknown, opts?: { plainText?: boolean }) =>
    opts?.plainText ? 'plain text body' : '<html>hi</html>',
  ),
}));

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: sendMock }) }));

const { sendEmail } = await import('@/lib/email');

const react = React.createElement('div', null, 'hello');

beforeEach(() => {
  sendMock.mockReset();
  vi.unstubAllEnvs();
});

describe('sendEmail', () => {
  it('is a dry run (no SMTP call) when Gmail credentials are absent', async () => {
    vi.stubEnv('GMAIL_USER', '');
    vi.stubEnv('GMAIL_APP_PASSWORD', '');
    const result = await sendEmail({ to: 'fan@example.com', subject: 'Hi', react });
    expect(result).toEqual({ ok: true, dryRun: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends rendered HTML + text through Gmail SMTP when credentials are present', async () => {
    vi.stubEnv('GMAIL_USER', 'shop@gmail.com');
    vi.stubEnv('GMAIL_APP_PASSWORD', 'app-pass');
    sendMock.mockResolvedValue({ messageId: '<1@gmail>' });
    const result = await sendEmail({ to: 'fan@example.com', subject: 'Hi', react });
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'fan@example.com',
        subject: 'Hi',
        html: '<html>hi</html>',
        text: 'plain text body',
      }),
    );
    expect(result).toEqual({ ok: true, dryRun: false });
  });

  it('defaults the From to the Gmail account, and honours MAIL_FROM when set', async () => {
    vi.stubEnv('GMAIL_USER', 'shop@gmail.com');
    vi.stubEnv('GMAIL_APP_PASSWORD', 'app-pass');
    sendMock.mockResolvedValue({ messageId: '1' });

    await sendEmail({ to: 'fan@example.com', subject: 'Hi', react });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'rainbykello <shop@gmail.com>' }),
    );

    sendMock.mockClear();
    vi.stubEnv('MAIL_FROM', 'rainbykello <hello@example.com>');
    await sendEmail({ to: 'fan@example.com', subject: 'Hi', react });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'rainbykello <hello@example.com>' }),
    );
  });

  it('surfaces the error when sending fails', async () => {
    vi.stubEnv('GMAIL_USER', 'shop@gmail.com');
    vi.stubEnv('GMAIL_APP_PASSWORD', 'app-pass');
    sendMock.mockRejectedValue(new Error('rate limited'));
    const result = await sendEmail({ to: 'fan@example.com', subject: 'Hi', react });
    expect(result).toEqual({ ok: false, error: 'rate limited' });
  });
});
