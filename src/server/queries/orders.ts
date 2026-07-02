import 'server-only';
import { createServiceRoleSupabase } from '@/db/server';
import { verifyOrderToken } from '@/lib/order-token';

export async function getOrderForGuest(id: string, token: string) {
  const supa = createServiceRoleSupabase();
  const { data: order } = await supa.from('orders').select('*').eq('id', id).maybeSingle();
  if (!order) return null;
  if (!verifyOrderToken(token, id, order.customer_email)) return null;
  const { data: items } = await supa.from('order_items').select('*').eq('order_id', id);
  return { order, items: items ?? [] };
}
