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
