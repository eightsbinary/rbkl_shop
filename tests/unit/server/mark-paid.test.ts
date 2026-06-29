import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/email', () => ({ sendEmail: vi.fn(async () => {}) }));
vi.mock('emails/OrderPaid', () => ({ default: () => null }));

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/db/types.gen';
import { markOrderPaid } from '@/server/orders/mark-paid';

type FakeSupa = SupabaseClient<Database>;

interface FakeOrder {
  id: string;
  status: string;
  total_thb: number;
  number: string;
  customer_email: string;
  locale: string;
}

interface FakeItem {
  variant_id: string | null;
  qty: number;
  product_snapshot: unknown;
}

function buildFakeSupa(opts: {
  order: FakeOrder | null;
  items?: FakeItem[];
  variants?: Record<string, { stock_reserved: number }>;
}) {
  const ordersUpdates: unknown[] = [];
  const variantsUpdates: Record<string, unknown[]> = {};
  const eventsInserts: unknown[] = [];
  const items = opts.items ?? [];
  const variants = opts.variants ?? {};

  const supa = {
    from: (table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: opts.order }),
            }),
          }),
          update: (payload: unknown) => ({
            eq: () => {
              ordersUpdates.push(payload);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'order_items') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: items }),
          }),
        };
      }
      if (table === 'variants') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: () => Promise.resolve({ data: variants[id] ?? null }),
            }),
          }),
          update: (payload: unknown) => ({
            eq: (_col: string, id: string) => {
              variantsUpdates[id] = variantsUpdates[id] ?? [];
              variantsUpdates[id].push(payload);
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === 'order_events') {
        return {
          insert: (payload: unknown) => {
            eventsInserts.push(payload);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as FakeSupa;

  return { supa, ordersUpdates, variantsUpdates, eventsInserts };
}

describe('markOrderPaid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-secret-key-for-unit-tests';
  });

  it('is idempotent: does nothing when order is already paid', async () => {
    const { supa, ordersUpdates, eventsInserts } = buildFakeSupa({
      order: {
        id: 'order-1',
        status: 'paid',
        total_thb: 500,
        number: 'ORD-001',
        customer_email: 'buyer@example.com',
        locale: 'en',
      },
    });

    await markOrderPaid(supa, 'order-1');

    expect(ordersUpdates).toHaveLength(0);
    expect(eventsInserts).toHaveLength(0);
  });

  it('happy path: sets status paid, releases reserved stock, logs event', async () => {
    const { supa, ordersUpdates, variantsUpdates, eventsInserts } = buildFakeSupa({
      order: {
        id: 'order-2',
        status: 'awaiting_verification',
        total_thb: 1000,
        number: 'ORD-002',
        customer_email: 'buyer@example.com',
        locale: 'en',
      },
      items: [
        {
          variant_id: 'var-1',
          qty: 2,
          product_snapshot: { name: { en: 'Tee Shirt', th: 'เสื้อยืด' } },
        },
      ],
      variants: {
        'var-1': { stock_reserved: 5 },
      },
    });

    await markOrderPaid(supa, 'order-2', { actor: 'test-actor' });

    // orders.update should set status:'paid' with ship_status:'preparing'
    expect(ordersUpdates).toHaveLength(1);
    expect(ordersUpdates[0]).toMatchObject({ status: 'paid', ship_status: 'preparing' });

    // variants.update should decrement stock_reserved by qty (5 - 2 = 3)
    expect(variantsUpdates['var-1']).toEqual([{ stock_reserved: 3 }]);

    // order_events insert
    expect(eventsInserts).toHaveLength(1);
    expect(eventsInserts[0]).toMatchObject({
      order_id: 'order-2',
      type: 'payment.paid',
      actor: 'test-actor',
    });
  });
});
