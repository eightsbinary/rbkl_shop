import * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// `server-only` throws when imported outside an RSC graph; stub it for the test.
vi.mock('server-only', () => ({}));

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

const { sendEmail } = await import('@/lib/email');

const react = React.createElement('div', null, 'hello');

beforeEach(() => {
  sendMock.mockReset();
  vi.unstubAllEnvs();
});

describe('sendEmail', () => {
  it('is a dry run (no SDK call) when RESEND_API_KEY is absent', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const result = await sendEmail({ to: 'fan@example.com', subject: 'Hi', react });
    expect(result).toEqual({ ok: true, dryRun: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('sends through Resend when the key is present', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    sendMock.mockResolvedValue({ error: null });
    const result = await sendEmail({ to: 'fan@example.com', subject: 'Hi', react });
    expect(sendMock).toHaveBeenCalledOnce();
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'fan@example.com', subject: 'Hi', react }),
    );
    expect(result).toEqual({ ok: true, dryRun: false });
  });

  it('surfaces the error when Resend fails', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    sendMock.mockResolvedValue({ error: { message: 'rate limited' } });
    const result = await sendEmail({ to: 'fan@example.com', subject: 'Hi', react });
    expect(result).toEqual({ ok: false, error: 'rate limited' });
  });
});
