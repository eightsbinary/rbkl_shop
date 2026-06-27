import 'server-only';
import { createServerSupabase } from '@/db/server';
import type { Database } from '@/db/types.gen';

export type OrderStatus = Database['public']['Enums']['order_status'];
export type ShipStatus = Database['public']['Enums']['ship_status'];

export interface AdminOrderRow {
  id: string;
  number: string;
  customer_email: string;
  status: OrderStatus;
  ship_status: ShipStatus;
  total_thb: number;
  created_at: string;
}

export const ORDER_STATUSES: OrderStatus[] = [
  'awaiting_payment',
  'paid',
  'failed',
  'cancelled',
  'refunded',
];

/** List orders for the admin table, newest first, optionally filtered by status. */
export async function listAdminOrders(status?: OrderStatus): Promise<AdminOrderRow[]> {
  const supa = await createServerSupabase();
  let query = supa
    .from('orders')
    .select('id, number, customer_email, status, ship_status, total_thb, created_at')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return data ?? [];
}

type OrderRow = Database['public']['Tables']['orders']['Row'];
type OrderItemRow = Database['public']['Tables']['order_items']['Row'];
type OrderEventRow = Database['public']['Tables']['order_events']['Row'];

export interface AdminOrderDetail {
  order: OrderRow;
  items: Pick<
    OrderItemRow,
    'id' | 'qty' | 'unit_price_thb' | 'line_total_thb' | 'product_snapshot'
  >[];
  events: Pick<OrderEventRow, 'id' | 'type' | 'payload' | 'actor' | 'created_at'>[];
}

/** Full order detail for the admin order page: order, line items, audit trail. */
export async function getAdminOrder(id: string): Promise<AdminOrderDetail | null> {
  const supa = await createServerSupabase();
  const { data: order } = await supa.from('orders').select('*').eq('id', id).maybeSingle();
  if (!order) return null;

  const [{ data: items }, { data: events }] = await Promise.all([
    supa
      .from('order_items')
      .select('id, qty, unit_price_thb, line_total_thb, product_snapshot')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
    supa
      .from('order_events')
      .select('id, type, payload, actor, created_at')
      .eq('order_id', id)
      .order('created_at', { ascending: true }),
  ]);

  return { order, items: items ?? [], events: events ?? [] };
}
