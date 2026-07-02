import WaitlistRestock, { subject as waitlistRestockSubject } from 'emails/WaitlistRestock';
import { type NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/db/server';
import { sendEmail } from '@/lib/email';

const BATCH_SIZE = 20;
const BATCH_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours between batches per variant

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

type Nested<T> = T | T[] | null;
const one = <T>(v: Nested<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

interface PendingEntry {
  id: string;
  email: string;
  locale: 'th' | 'en';
  stock: number;
  productName: string;
  slug: string;
}

/**
 * Notify fans waiting on variants that are back in stock. Emails up to 20 oldest
 * waiters per variant per run, leaving a 4-hour gap before the next batch for the
 * same variant to avoid inbox storms.
 */
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const svc = createServiceRoleSupabase();
  const { data } = await svc
    .from('waitlist_entries')
    .select('id, email, locale, variant_id, variants(stock_available, products(name, slug))')
    .is('notified_at', null)
    .order('created_at', { ascending: true });

  // Group oldest-first pending waiters by variant (only those back in stock).
  const byVariant = new Map<string, PendingEntry[]>();
  for (const row of data ?? []) {
    if (!row.variant_id) continue;
    const variant = one(row.variants);
    const stock = variant?.stock_available ?? 0;
    if (stock <= 0) continue;
    const product = one(variant?.products ?? null);
    const nameObj = (product?.name ?? {}) as { en?: string; th?: string };
    const locale = row.locale === 'th' ? 'th' : 'en';
    const entry: PendingEntry = {
      id: row.id,
      email: row.email,
      locale,
      stock,
      productName: nameObj[locale] ?? nameObj.en ?? nameObj.th ?? product?.slug ?? 'product',
      slug: product?.slug ?? '',
    };
    const list = byVariant.get(row.variant_id);
    if (list) list.push(entry);
    else byVariant.set(row.variant_id, [entry]);
  }

  let notified = 0;
  const recentCutoff = new Date(Date.now() - BATCH_GAP_MS).toISOString();

  for (const [variantId, entries] of byVariant) {
    // Respect the 4-hour gap: skip if this variant was notified recently.
    const { data: recent } = await svc
      .from('waitlist_entries')
      .select('id')
      .eq('variant_id', variantId)
      .gt('notified_at', recentCutoff)
      .limit(1);
    if (recent && recent.length > 0) continue;

    for (const entry of entries.slice(0, BATCH_SIZE)) {
      const productUrl = `${siteUrl()}/${entry.locale}/product/${entry.slug}`;
      try {
        await sendEmail({
          to: entry.email,
          subject: waitlistRestockSubject(entry.locale, entry.productName),
          react: WaitlistRestock({
            locale: entry.locale,
            productName: entry.productName,
            productUrl,
          }),
        });
      } catch (err) {
        console.error('[notify-waitlist] email failed', err);
      }
      await svc
        .from('waitlist_entries')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', entry.id);
      notified += 1;
    }
  }

  return NextResponse.json({ ok: true, notified });
}
