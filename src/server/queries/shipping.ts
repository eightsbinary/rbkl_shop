import 'server-only';
import { createServiceRoleSupabase } from '@/db/server';

export interface AdminShippingZone {
  id: string;
  code: string;
  name: { th?: string; en?: string };
  countries: string[];
  flatRateThb: number;
  isActive: boolean;
}

/** All shipping zones (including inactive) for the admin editor. Service-role
 *  read so inactive zones are visible regardless of the public-read RLS. */
export async function getShippingZones(): Promise<AdminShippingZone[]> {
  const svc = createServiceRoleSupabase();
  const { data } = await svc
    .from('shipping_zones')
    .select('id, code, name, countries, flat_rate_thb, is_active')
    .order('sort');
  return (data ?? []).map((z) => ({
    id: z.id,
    code: z.code,
    name: (z.name as { th?: string; en?: string }) ?? {},
    countries: z.countries,
    flatRateThb: z.flat_rate_thb,
    isActive: z.is_active,
  }));
}
