import 'server-only';
import { render } from '@react-email/components';
import { createTransport } from 'nodemailer';
import type { ReactElement } from 'react';

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
}

export type SendEmailResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

/**
 * Send a transactional email via Gmail SMTP (App Password auth). When the Gmail
 * credentials are unset (local dev / demo) this logs and returns a dry-run
 * result instead of sending, so email never blocks a flow that's otherwise
 * working.
 *
 * Gmail forces the envelope sender to the authenticated account, so `from` only
 * really controls the display name; it defaults to the account address.
 */
export async function sendEmail({ to, subject, react }: SendEmailInput): Promise<SendEmailResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.log(`[email] (no GMAIL credentials) → would send to ${to}: ${subject}`);
    return { ok: true, dryRun: true };
  }

  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);
  const from = process.env.MAIL_FROM || `rainbykello <${user}>`;
  const transport = createTransport({ service: 'gmail', auth: { user, pass } });

  try {
    await transport.sendMail({ from, to, subject, html, text });
    return { ok: true, dryRun: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
}
