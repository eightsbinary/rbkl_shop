import 'server-only';
import type { ReactElement } from 'react';
import { Resend } from 'resend';

const FROM = process.env.RESEND_FROM ?? 'rainbykello <onboarding@resend.dev>';

export interface SendEmailInput {
  to: string;
  subject: string;
  react: ReactElement;
}

export type SendEmailResult = { ok: true; dryRun: boolean } | { ok: false; error: string };

/**
 * Send a transactional email via Resend. When RESEND_API_KEY is unset (local
 * dev / demo) this logs and returns a dry-run result instead of sending, so
 * email never blocks a flow that's otherwise working.
 */
export async function sendEmail({ to, subject, react }: SendEmailInput): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] (no RESEND_API_KEY) → would send to ${to}: ${subject}`);
    return { ok: true, dryRun: true };
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({ from: FROM, to, subject, react });
  if (error) return { ok: false, error: error.message };
  return { ok: true, dryRun: false };
}
