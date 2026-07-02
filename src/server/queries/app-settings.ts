import 'server-only';
import { createServerSupabase } from '@/db/server';

export type EmailProvider = 'gmail' | 'resend';

export async function getEmailProvider(): Promise<EmailProvider> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('app_settings')
    .select('email_provider')
    .eq('id', 'singleton')
    .maybeSingle();
  return data?.email_provider === 'resend' ? 'resend' : 'gmail';
}
