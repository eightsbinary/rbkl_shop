import 'server-only';
import { createServiceRoleSupabase } from '@/db/server';
import { buildTrackingUrl } from '@/domain/carriers';
import type { ApplyOp } from '@/domain/sheets-sync/diff';
import { SCHEMAS, type SyncTable, type TableSnapshot } from '@/domain/sheets-sync/schema';

type Json = Record<string, unknown>;
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const loc = (j: unknown, k: 'th' | 'en'): string => s((j as Json | null)?.[k]);

/** Build the snapshot for one table directly from the DB (DB is source of truth). */
export async function readSnapshot(table: SyncTable): Promise<TableSnapshot> {
  const svc = createServiceRoleSupabase();
  if (table === 'products') {
    const { data } = await svc
      .from('products')
      .select('id, version, slug, name, description, base_price_thb, status')
      .order('created_at', { ascending: true });
    return {
      table,
      rows: (data ?? []).map((r) => ({
        pk: r.id,
        version: r.version,
        values: {
          slug: s(r.slug),
          'name.th': loc(r.name, 'th'),
          'name.en': loc(r.name, 'en'),
          'description.th': loc(r.description, 'th'),
          'description.en': loc(r.description, 'en'),
          base_price_thb: s(r.base_price_thb),
          status: s(r.status),
        },
      })),
    };
  }
  if (table === 'variants') {
    const { data } = await svc
      .from('variants')
      .select('id, version, sku, price_thb, stock_available, is_active')
      .order('created_at', { ascending: true });
    return {
      table,
      rows: (data ?? []).map((r) => ({
        pk: r.id,
        version: r.version,
        values: {
          sku: s(r.sku),
          price_thb: s(r.price_thb),
          stock_available: s(r.stock_available),
          is_active: r.is_active ? 'TRUE' : 'FALSE',
        },
      })),
    };
  }
  const { data } = await svc
    .from('orders')
    .select(
      'id, version, number, customer_email, ship_status, tracking_carrier, tracking_number, notes_to_buyer',
    )
    .order('created_at', { ascending: true });
  return {
    table,
    rows: (data ?? []).map((r) => ({
      pk: r.id,
      version: r.version,
      values: {
        number: s(r.number),
        customer_email: s(r.customer_email),
        ship_status: s(r.ship_status),
        tracking_carrier: s(r.tracking_carrier),
        tracking_number: s(r.tracking_number),
        notes_to_buyer: s(r.notes_to_buyer),
      },
    })),
  };
}

/** Flat column→value payload for variants/orders (products is handled inline in
 *  applyOps because it merges jsonb name/description). */
function toDbPayload(table: 'variants' | 'orders', changes: Record<string, unknown>): Json {
  const allowed =
    table === 'variants'
      ? (['price_thb', 'stock_available', 'is_active'] as const)
      : (['ship_status', 'tracking_carrier', 'tracking_number', 'notes_to_buyer'] as const);
  const out: Json = {};
  for (const k of allowed) {
    if (k in changes) out[k] = changes[k];
  }
  return out;
}

/** Apply one table's ApplyOps. Each op reads-merges jsonb where needed, bumps version. */
export async function applyOps(table: SyncTable, ops: ApplyOp[]): Promise<void> {
  const svc = createServiceRoleSupabase();
  for (const op of ops) {
    if (table === 'products') {
      const { data: cur } = await svc
        .from('products')
        .select('name, description')
        .eq('id', op.pk)
        .single();
      const payload: Json = { version: op.nextVersion };
      const name = { ...((cur?.name as Json) ?? {}) };
      const desc = { ...((cur?.description as Json) ?? {}) };
      if ('name.th' in op.changes) name.th = op.changes['name.th'];
      if ('name.en' in op.changes) name.en = op.changes['name.en'];
      if ('description.th' in op.changes) desc.th = op.changes['description.th'];
      if ('description.en' in op.changes) desc.en = op.changes['description.en'];
      if ('name.th' in op.changes || 'name.en' in op.changes) payload.name = name;
      if ('description.th' in op.changes || 'description.en' in op.changes)
        payload.description = desc;
      if ('base_price_thb' in op.changes) payload.base_price_thb = op.changes.base_price_thb;
      if ('status' in op.changes) payload.status = op.changes.status;
      const pq = svc.from('products');
      // biome-ignore lint/suspicious/noExplicitAny: dynamic Supabase payload — columns are runtime-determined
      const { error } = await pq.update(payload as any).eq('id', op.pk);
      if (error) throw new Error(`products update ${op.pk} failed: ${error.message}`);
    } else if (table === 'variants') {
      const { error } = await svc
        .from('variants')
        .update({ ...toDbPayload(table, op.changes), version: op.nextVersion })
        .eq('id', op.pk);
      if (error) throw new Error(`variants update ${op.pk} failed: ${error.message}`);
    } else {
      const payload = { ...toDbPayload(table, op.changes), version: op.nextVersion } as Json;
      // Recompute derived tracking_url when carrier/number changed.
      if ('tracking_carrier' in op.changes || 'tracking_number' in op.changes) {
        const { data: cur } = await svc
          .from('orders')
          .select('tracking_carrier, tracking_number')
          .eq('id', op.pk)
          .single();
        const carrier = (op.changes.tracking_carrier as string) ?? cur?.tracking_carrier ?? '';
        const number = (op.changes.tracking_number as string) ?? cur?.tracking_number ?? '';
        payload.tracking_url = carrier && number ? buildTrackingUrl(carrier, number) : null;
      }
      const oq = svc.from('orders');
      // biome-ignore lint/suspicious/noExplicitAny: dynamic Supabase payload — columns are runtime-determined
      const { error } = await oq.update(payload as any).eq('id', op.pk);
      if (error) throw new Error(`orders update ${op.pk} failed: ${error.message}`);
    }
  }
}

export const SYNC_TABLES = Object.keys(SCHEMAS) as SyncTable[];
