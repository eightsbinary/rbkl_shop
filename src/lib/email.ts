import 'server-only';
import { render } from '@react-email/components';
import { createTransport } from 'nodemailer';
import type { ReactElement } from 'react';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
}

export type SendEmailResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

type Provider = 'resend' | 'gmail';

/**
 * Pick the email provider. Defaults to Gmail; set `EMAIL_PROVIDER=resend` to
 * switch (e.g. once a domain is registered). Each provider dry-runs on its own
 * when its credentials are absent.
 */
function resolveProvider(): Provider {
  return process.env.EMAIL_PROVIDER === 'resend' ? 'resend' : 'gmail';
}

/** Resend — preferred once a domain is verified in RESEND_FROM. */
async function sendViaResend(input: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] (resend selected, no RESEND_API_KEY) → would send to ${input.to}`);
    return { ok: true, dryRun: true };
  }
  const from = process.env.RESEND_FROM ?? 'rainbykello <onboarding@resend.dev>';
  const { error } = await new Resend(key).emails.send({ from, ...input });
  if (error) return { ok: false, error: error.message };
  return { ok: true, dryRun: false };
}

/** Gmail SMTP (App Password). Gmail forces the sender to the authenticated
 *  account, so `from` only controls the display name. */
async function sendViaGmail(input: SendEmailInput): Promise<SendEmailResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.log(`[email] (gmail selected, no GMAIL credentials) → would send to ${input.to}`);
    return { ok: true, dryRun: true };
  }
  const [html, text] = await Promise.all([
    render(input.react),
    render(input.react, { plainText: true }),
  ]);
  const from = process.env.MAIL_FROM || `rainbykello <${user}>`;
  try {
    await createTransport({ service: 'gmail', auth: { user, pass } }).sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html,
      text,
    });
    return { ok: true, dryRun: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Email send failed' };
  }
}

/**
 * Send a transactional email through the configured provider (Gmail today;
 * Resend once a domain is registered — see resolveProvider). When nothing is
 * configured this logs and returns a dry-run result, so email never blocks a
 * flow that's otherwise working.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  return resolveProvider() === 'resend' ? sendViaResend(input) : sendViaGmail(input);
}
