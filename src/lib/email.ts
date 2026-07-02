import 'server-only';
import { render } from '@react-email/components';
import { createTransport } from 'nodemailer';
import type { ReactElement } from 'react';
import { Resend } from 'resend';
import { createServiceRoleSupabase } from '@/db/server';

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
}

export type SendEmailResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

type Provider = 'resend' | 'gmail';

/**
 * Pick the email provider. The admin Settings toggle (`app_settings.email_provider`)
 * is authoritative; if the DB can't be read, fall back to the `EMAIL_PROVIDER`
 * env var, then to Gmail. Each provider dry-runs on its own when its credentials
 * are absent.
 */
async function resolveProvider(): Promise<Provider> {
  try {
    const { data } = await createServiceRoleSupabase()
      .from('app_settings')
      .select('email_provider')
      .eq('id', 'singleton')
      .maybeSingle();
    if (data?.email_provider === 'resend') return 'resend';
    if (data?.email_provider === 'gmail') return 'gmail';
  } catch {
    // DB unreachable — fall through to the env/default below.
  }
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
  const provider = await resolveProvider();
  return provider === 'resend' ? sendViaResend(input) : sendViaGmail(input);
}
