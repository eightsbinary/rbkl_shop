'use server';

import { headers } from 'next/headers';
import * as z from 'zod';
import { createServiceRoleSupabase } from '@/db/server';
import type { Json } from '@/db/types.gen';
import { generateOrderNumber } from '@/domain/order-number';
import { MockProvider } from '@/domain/payment/adapters/MockProvider';
import { signOrderToken } from '@/lib/order-token';

const ShippingAddress = z.object({
  fullName: z.string().min(1),
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  phone: z.string().optional(),
});

const PlaceOrderInput = z.object({
  email: z.string().email(),
  locale: z.enum(['th', 'en']),
  address: ShippingAddress,
  lines: z.array(z.object({ variantId: z.string().uuid(), qty: z.number().int().positive() })),
  discountCode: z.string().optional(),
});

export type PlaceOrderInputT = z.infer<typeof PlaceOrderInput>;

export async function placeOrder(raw: PlaceOrderInputT) {
  const parsed = PlaceOrderInput.safeParse(raw);
  if (!parsed.success) return { error: 'Invalid checkout data' };
  const input = parsed.data;
  const supa = createServiceRoleSupabase();

  const { data: variants, error: vErr } = await supa
    .from('variants')
    .select(
      'id, price_thb, stock_available, stock_reserved, is_active, option_values, product:products!inner(id, slug, name, base_price_thb, status, weight_grams)',
    )
    .in(
      'id',
      input.lines.map((l) => l.variantId),
    );
  if (vErr || !variants) return { error: 'Could not load cart' };

  let subtotal = 0;
  interface ItemDraft {
    variant_id: string;
    qty: number;
    unit_price_thb: number;
    line_total_thb: number;
    product_snapshot: Json;
  }
  const itemRows: ItemDraft[] = [];
  for (const line of input.lines) {
    const v = variants.find((x) => x.id === line.variantId);
    if (!v?.is_active) return { error: 'Variant unavailable' };
    const p = Array.isArray(v.product) ? v.product[0] : v.product;
    if (p?.status !== 'active') return { error: 'Product unavailable' };
    if (v.stock_available < line.qty) return { error: 'Not enough stock' };
    const unit = v.price_thb ?? p.base_price_thb;
    const lineTotal = unit * line.qty;
    subtotal += lineTotal;
    itemRows.push({
      variant_id: v.id,
      qty: line.qty,
      unit_price_thb: unit,
      line_total_thb: lineTotal,
      product_snapshot: {
        productId: p.id,
        slug: p.slug,
        name: p.name as Json,
        optionValues: v.option_values as Json,
      } as Json,
    });
  }

  const { data: zones } = await supa
    .from('shipping_zones')
    .select('*')
    .eq('is_active', true)
    .order('sort');
  if (!zones || zones.length === 0) return { error: 'No shipping zones configured' };
  const zone =
    zones.find((zn) => zn.countries.includes(input.address.country)) ??
    zones.find((zn) => zn.countries.includes('*'));
  if (!zone) return { error: 'No shipping zone matches your country' };

  let discount = 0;
  if (input.discountCode) {
    const { data: codeRow } = await supa
      .from('discount_codes')
      .select('*')
      .eq('code', input.discountCode)
      .eq('active', true)
      .maybeSingle();
    if (codeRow) {
      const now = new Date();
      if (now >= new Date(codeRow.starts_at) && now <= new Date(codeRow.ends_at)) {
        if (subtotal >= codeRow.min_subtotal_thb) {
          discount =
            codeRow.kind === 'fixed' ? codeRow.value : Math.floor((subtotal * codeRow.value) / 100);
        }
      }
    }
  }
  if (discount > subtotal) discount = subtotal;
  const total = subtotal - discount + zone.flat_rate_thb;

  for (const line of input.lines) {
    const v = variants.find((x) => x.id === line.variantId);
    if (!v) continue;
    const { error: updErr } = await supa
      .from('variants')
      .update({
        stock_available: v.stock_available - line.qty,
        stock_reserved: v.stock_reserved + line.qty,
      })
      .eq('id', v.id)
      .gte('stock_available', line.qty);
    if (updErr) return { error: 'Reservation failed' };
  }

  const number = generateOrderNumber();
  const { data: order, error: oErr } = await supa
    .from('orders')
    .insert({
      number,
      customer_email: input.email,
      status: 'awaiting_payment',
      subtotal_thb: subtotal,
      discount_thb: discount,
      shipping_thb: zone.flat_rate_thb,
      total_thb: total,
      locale: input.locale,
      shipping_address: input.address,
      payment_provider: 'mock',
    })
    .select('id, number')
    .single();
  if (oErr || !order) return { error: 'Could not create order' };

  await supa.from('order_items').insert(itemRows.map((row) => ({ ...row, order_id: order.id })));
  await supa.from('order_events').insert({
    order_id: order.id,
    type: 'order.created',
    payload: { lines: input.lines.length, total },
    actor: 'system',
  });

  const h = await headers();
  const origin = h.get('origin') ?? 'http://localhost:3000';
  const provider = new MockProvider();
  const handle = await provider.createCharge({
    orderId: order.id,
    orderNumber: order.number,
    amountThb: total,
    currency: 'THB',
    method: 'mock',
    returnUrl: `${origin}/${input.locale}/order/${order.id}?t=${signOrderToken(order.id, input.email)}`,
    notifyUrl: `${origin}/api/payments/notify/mock`,
    customerEmail: input.email,
  });

  await supa.from('orders').update({ payment_charge_id: handle.chargeId }).eq('id', order.id);

  return {
    ok: true as const,
    orderId: order.id,
    orderNumber: order.number,
    token: signOrderToken(order.id, input.email),
    redirectUrl: handle.redirectUrl ?? `/${input.locale}/order/${order.id}`,
  };
}
