'use server';

import { revalidatePath } from 'next/cache';
import { requireOwnerOrDev, stepUpGuard } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';
import { ShippingZonesSchema, type ZoneInput } from '@/domain/shipping-zones';

export async function saveShippingZones(
  zones: ZoneInput[],
): Promise<{ ok: true } | { error: string }> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const gate = await stepUpGuard(supa);
  if (gate) return gate;

  const parsed = ShippingZonesSchema.safeParse(zones);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid shipping zones' };
  }
  const input = parsed.data;

  const svc = createServiceRoleSupabase();
  const { data: existing } = await svc.from('shipping_zones').select('id');
  const existingIds = new Set((existing ?? []).map((r) => r.id));
  const keptIds = new Set(input.filter((z) => z.id).map((z) => z.id as string));

  // Delete zones the editor removed.
  const toDelete = [...existingIds].filter((id) => !keptIds.has(id));
  if (toDelete.length > 0) {
    const { error } = await svc.from('shipping_zones').delete().in('id', toDelete);
    if (error) return { error: error.message };
  }

  // Upsert each remaining zone; array order defines sort.
  for (const [sort, z] of input.entries()) {
    const row = {
      code: z.code,
      name: { th: z.name.th?.trim() || undefined, en: z.name.en?.trim() || undefined },
      countries: z.countries.map((c) => c.trim()),
      flat_rate_thb: z.flatRateThb,
      is_active: z.isActive,
      sort,
      updated_at: new Date().toISOString(),
    };
    const { error } =
      z.id && existingIds.has(z.id)
        ? await svc.from('shipping_zones').update(row).eq('id', z.id)
        : await svc.from('shipping_zones').insert(row);
    if (error) return { error: error.message };
  }

  revalidatePath('/admin/settings');
  return { ok: true };
}
