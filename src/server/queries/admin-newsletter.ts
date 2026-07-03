import 'server-only';
import { createServerSupabase } from '@/db/server';
import { searchPattern } from '@/server/queries/search';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  locale: string;
  source: string | null;
  status: string;
  createdAt: string;
}

/** All newsletter subscribers, newest first, optionally filtered by an email
 *  search term. RLS restricts this to owner/dev. */
export async function listNewsletterSubscribers(search?: string): Promise<NewsletterSubscriber[]> {
  const supa = await createServerSupabase();
  let query = supa
    .from('newsletter_subscribers')
    .select('id, email, locale, source, status, created_at')
    .order('created_at', { ascending: false });
  const pattern = search ? searchPattern(search) : null;
  if (pattern) query = query.ilike('email', pattern);
  const { data } = await query;

  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    locale: r.locale,
    source: r.source,
    status: r.status,
    createdAt: r.created_at,
  }));
}
