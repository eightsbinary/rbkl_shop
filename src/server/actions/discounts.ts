'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireOwnerOrDev } from '@/db/auth';
import { createServerSupabase, createServiceRoleSupabase } from '@/db/server';

const DiscountInput = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .transform((s) => s.toUpperCase()),
    kind: z.enum(['fixed', 'percent']),
    value: z.coerce.number().int().min(0),
    minSubtotalThb: z.coerce.number().int().min(0),
    startsAt: z.string().min(1),
    endsAt: z.string().min(1),
    maxUses: z.coerce.number().int().positive().nullable(),
    active: z.boolean(),
  })
  .refine((d) => d.kind !== 'percent' || d.value <= 100, {
    message: 'Percent discount cannot exceed 100',
    path: ['value'],
  })
  .refine((d) => new Date(d.startsAt) < new Date(d.endsAt), {
    message: 'End date must be after start date',
    path: ['endsAt'],
  });

export type DiscountInputRaw = z.input<typeof DiscountInput>;

type ActionResult = { ok: true; id: string } | { error: string };

function toRow(input: z.infer<typeof DiscountInput>) {
  return {
    code: input.code,
    kind: input.kind,
    value: input.value,
    min_subtotal_thb: input.minSubtotalThb,
    starts_at: new Date(input.startsAt).toISOString(),
    ends_at: new Date(input.endsAt).toISOString(),
    max_uses: input.maxUses,
    active: input.active,
  };
}

export async function createDiscount(raw: DiscountInputRaw): Promise<ActionResult> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const parsed = DiscountInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const svc = createServiceRoleSupabase();
  const { data, error } = await svc
    .from('discount_codes')
    .insert(toRow(parsed.data))
    .select('id')
    .single();
  if (error || !data) {
    return {
      error: error?.code === '23505' ? 'That code already exists' : (error?.message ?? 'Failed'),
    };
  }
  revalidatePath('/admin/discounts');
  return { ok: true, id: data.id };
}

export async function updateDiscount(id: string, raw: DiscountInputRaw): Promise<ActionResult> {
  const supa = await createServerSupabase();
  await requireOwnerOrDev(supa);
  const parsed = DiscountInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const svc = createServiceRoleSupabase();
  const { error } = await svc
    .from('discount_codes')
    .update({ ...toRow(parsed.data), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    return { error: error.code === '23505' ? 'That code already exists' : error.message };
  }
  revalidatePath('/admin/discounts');
  revalidatePath(`/admin/discounts/${id}/edit`);
  return { ok: true, id };
}
