#!/usr/bin/env bun
// Seed demo orders (every status/ship state), waitlist entries, newsletter
// subscribers, and a discount code, so the admin pages and dashboard stats have
// realistic content in local dev. Requires seed:products to have run first.
// Idempotent: skips if any seed-demo order already exists.
// Usage: bun run seed:demo

import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/db/types.gen';
import { generateOrderNumber } from '@/domain/order-number';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}
const supa = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SEED_TAG = 'seed-demo';

const { count } = await supa
  .from('orders')
  .select('id', { count: 'exact', head: true })
  .eq('notes_internal', SEED_TAG);
if ((count ?? 0) > 0) {
  console.log('Demo data already seeded — skipped. (Delete orders with notes_internal=seed-demo to reseed.)');
  process.exit(0);
}

// Load the seeded catalog to reference real variants/prices/snapshots.
const { data: products } = await supa
  .from('products')
  .select('id, slug, name, base_price_thb, variants(id, option_values)')
  .in('slug', ['aura-tote', 'nano-tee', 'nano-notebook', 'nano-mug']);
if (!products || products.length < 4) {
  console.error('Seed products not found — run `bun run seed:products` first.');
  process.exit(1);
}

function pick(slug: string, optionValues?: Record<string, string>) {
  const p = products?.find((x) => x.slug === slug);
  if (!p) throw new Error(`missing product ${slug}`);
  const v = optionValues
    ? p.variants.find(
        (x) => JSON.stringify(x.option_values) === JSON.stringify(optionValues),
      )
    : p.variants[0];
  if (!v) throw new Error(`missing variant for ${slug}`);
  return { product: p, variant: v };
}

const daysAgo = (n: number, hourUtc = 5) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
};

const address = (fullName: string): Json => ({
  fullName,
  line1: '99/1 ถนนสุขุมวิท',
  line2: 'แขวงคลองตัน เขตคลองเตย',
  city: 'กรุงเทพมหานคร',
  postalCode: '10110',
  country: 'TH',
});

interface DemoLine {
  slug: string;
  qty: number;
  optionValues?: Record<string, string>;
}

interface DemoOrder {
  email: string;
  name: string;
  locale: 'th' | 'en';
  status: 'awaiting_payment' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  shipStatus?: 'pending' | 'preparing' | 'shipped' | 'delivered';
  createdDaysAgo: number;
  paidDaysAgo?: number;
  shipping: number;
  lines: DemoLine[];
  tracking?: { carrier: string; number: string };
}

const DEMO: DemoOrder[] = [
  // Today — fresh unpaid order (shows in "awaiting payment").
  {
    email: 'mali@example.com', name: 'มะลิ ใจดี', locale: 'th',
    status: 'awaiting_payment', createdDaysAgo: 0, shipping: 50,
    lines: [{ slug: 'aura-tote', qty: 1 }],
  },
  // Today — paid, not shipped yet (revenue "today" + "to ship").
  {
    email: 'ploy@example.com', name: 'พลอย รักดี', locale: 'th',
    status: 'paid', shipStatus: 'pending', createdDaysAgo: 0, paidDaysAgo: 0, shipping: 50,
    lines: [{ slug: 'nano-tee', qty: 2, optionValues: { size: 'M' } }],
  },
  // 2 days ago — paid, being prepared (7-day revenue + "to ship").
  {
    email: 'nok@example.com', name: 'นก สুขใจ', locale: 'th',
    status: 'paid', shipStatus: 'preparing', createdDaysAgo: 2, paidDaysAgo: 2, shipping: 50,
    lines: [{ slug: 'nano-mug', qty: 1 }, { slug: 'nano-notebook', qty: 1 }],
  },
  // 5 days ago — paid and shipped with tracking (7-day revenue).
  {
    email: 'james@example.com', name: 'James Miller', locale: 'en',
    status: 'paid', shipStatus: 'shipped', createdDaysAgo: 5, paidDaysAgo: 5, shipping: 120,
    lines: [{ slug: 'nano-tee', qty: 1, optionValues: { size: 'L' } }],
    tracking: { carrier: 'thailand_post', number: 'EG123456789TH' },
  },
  // 20 days ago — delivered (30-day revenue).
  {
    email: 'fah@example.com', name: 'ฟ้า แจ่มใส', locale: 'th',
    status: 'paid', shipStatus: 'delivered', createdDaysAgo: 20, paidDaysAgo: 20, shipping: 50,
    lines: [{ slug: 'aura-tote', qty: 2 }],
  },
  // 40 days ago — delivered (all-time revenue only).
  {
    email: 'aom@example.com', name: 'ออม บุญมี', locale: 'th',
    status: 'paid', shipStatus: 'delivered', createdDaysAgo: 40, paidDaysAgo: 40, shipping: 50,
    lines: [{ slug: 'nano-notebook', qty: 3 }],
  },
  // Cancelled before payment (3 days ago) — excluded from revenue.
  {
    email: 'beam@example.com', name: 'บีม ทองดี', locale: 'th',
    status: 'cancelled', createdDaysAgo: 3, shipping: 50,
    lines: [{ slug: 'nano-mug', qty: 2 }],
  },
  // Refunded (15 days ago) — excluded from revenue.
  {
    email: 'sara@example.com', name: 'Sara Cole', locale: 'en',
    status: 'refunded', createdDaysAgo: 15, paidDaysAgo: 15, shipping: 120,
    lines: [{ slug: 'nano-tee', qty: 1, optionValues: { size: 'S' } }],
  },
  // Failed payment (today) — excluded from revenue.
  {
    email: 'ton@example.com', name: 'ต้น กล้าหาญ', locale: 'th',
    status: 'failed', createdDaysAgo: 0, shipping: 50,
    lines: [{ slug: 'aura-tote', qty: 1 }],
  },
];

for (const demo of DEMO) {
  const lines = demo.lines.map((l) => {
    const { product, variant } = pick(l.slug, l.optionValues);
    return { ...l, product, variant, unit: product.base_price_thb };
  });
  const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);

  const { data: order, error } = await supa
    .from('orders')
    .insert({
      number: generateOrderNumber(),
      customer_email: demo.email,
      status: demo.status,
      subtotal_thb: subtotal,
      discount_thb: 0,
      shipping_thb: demo.shipping,
      total_thb: subtotal + demo.shipping,
      locale: demo.locale,
      shipping_address: address(demo.name),
      payment_provider: 'promptpay',
      payment_method: 'bank_transfer_slip',
      created_at: daysAgo(demo.createdDaysAgo, 3),
      paid_at: demo.paidDaysAgo !== undefined ? daysAgo(demo.paidDaysAgo) : null,
      ship_status: demo.shipStatus ?? 'pending',
      shipped_at: demo.shipStatus === 'shipped' || demo.shipStatus === 'delivered'
        ? daysAgo(Math.max(0, (demo.paidDaysAgo ?? 0) - 1))
        : null,
      delivered_at: demo.shipStatus === 'delivered'
        ? daysAgo(Math.max(0, (demo.paidDaysAgo ?? 0) - 3))
        : null,
      tracking_carrier: demo.tracking?.carrier ?? null,
      tracking_number: demo.tracking?.number ?? null,
      notes_internal: SEED_TAG,
    })
    .select('id, number')
    .single();
  if (error || !order) {
    console.error(`✗ order for ${demo.email} failed:`, error?.message);
    process.exit(1);
  }

  const { error: itemsErr } = await supa.from('order_items').insert(
    lines.map((l) => ({
      order_id: order.id,
      variant_id: l.variant.id,
      qty: l.qty,
      unit_price_thb: l.unit,
      line_total_thb: l.unit * l.qty,
      product_snapshot: {
        productId: l.product.id,
        slug: l.product.slug,
        name: l.product.name,
        optionValues: l.variant.option_values,
      } as Json,
    })),
  );
  if (itemsErr) {
    console.error(`✗ items for ${order.number} failed:`, itemsErr.message);
    process.exit(1);
  }
  console.log(`✓ order ${order.number} — ${demo.status}/${demo.shipStatus ?? '-'} ฿${subtotal + demo.shipping} (${demo.email})`);
}

// Waitlist entries on the tote (2 pending, 1 already notified).
const tote = pick('aura-tote');
const { error: wlErr } = await supa.from('waitlist_entries').upsert(
  [
    { variant_id: tote.variant.id, email: 'fan1@example.com', locale: 'th' as const },
    { variant_id: tote.variant.id, email: 'fan2@example.com', locale: 'en' as const },
    {
      variant_id: tote.variant.id,
      email: 'fan3@example.com',
      locale: 'th' as const,
      notified_at: daysAgo(1),
    },
  ],
  { onConflict: 'variant_id,email', ignoreDuplicates: true },
);
if (wlErr) console.error('waitlist seed failed:', wlErr.message);
else console.log('✓ 3 waitlist entries (aura-tote)');

// Newsletter subscribers.
const { error: nlErr } = await supa.from('newsletter_subscribers').upsert(
  [
    { email: 'mali@example.com', locale: 'th' as const, source: 'home_band', status: 'active' as const },
    { email: 'james@example.com', locale: 'en' as const, source: 'checkout', status: 'active' as const },
    { email: 'ploy@example.com', locale: 'th' as const, source: 'home_band', status: 'active' as const },
    {
      email: 'gone@example.com',
      locale: 'en' as const,
      source: 'home_band',
      status: 'unsubscribed' as const,
      unsubscribed_at: daysAgo(2),
    },
  ],
  { onConflict: 'email', ignoreDuplicates: true },
);
if (nlErr) console.error('newsletter seed failed:', nlErr.message);
else console.log('✓ 4 newsletter subscribers');

// A live discount code.
const { error: dcErr } = await supa.from('discount_codes').upsert(
  {
    code: 'WELCOME10',
    kind: 'percent',
    value: 10,
    min_subtotal_thb: 300,
    starts_at: daysAgo(7),
    ends_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    active: true,
  },
  { onConflict: 'code', ignoreDuplicates: true },
);
if (dcErr) console.error('discount seed failed:', dcErr.message);
else console.log('✓ discount code WELCOME10 (10% over ฿300)');

console.log('Done.');
