import 'server-only';
import { createServerSupabase } from '@/db/server';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  locale: string;
  source: string | null;
  status: string;
  createdAt: string;
}

/** All newsletter subscribers, newest first. RLS restricts this to owner/dev. */
export async function listNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  const supa = await createServerSupabase();
  const { data } = await supa
    .from('newsletter_subscribers')
    .select('id, email, locale, source, status, created_at')
    .order('created_at', { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    locale: r.locale,
    source: r.source,
    status: r.status,
    createdAt: r.created_at,
  }));
}
