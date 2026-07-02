import * as z from 'zod';

/** Validation for an editable shipping zone (admin Shipping settings). Kept in
 *  domain/ — pure, no I/O — so both the server action and tests can import it
 *  (a 'use server' file may only export async functions). */
export const ZoneSchema = z.object({
  id: z.string().uuid().optional(),
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, 'Code: letters, numbers, - or _ only'),
  name: z.object({ th: z.string().optional(), en: z.string().optional() }),
  countries: z.array(z.string().trim().min(1)).min(1, 'At least one country (or * for worldwide)'),
  flatRateThb: z.number().int().min(0),
  isActive: z.boolean(),
});

export const ShippingZonesSchema = z.array(ZoneSchema).superRefine((zones, ctx) => {
  const codes = zones.map((zone) => zone.code.toLowerCase());
  if (new Set(codes).size !== codes.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate zone codes' });
  }
});

export type ZoneInput = z.infer<typeof ZoneSchema>;
