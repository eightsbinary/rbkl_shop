import * as z from 'zod';

/** Editable product-page accordion copy (shared by every product). */
export const PRODUCT_COPY_FIELDS = [
  'detailsTitle',
  'detailsBody',
  'shippingTitle',
  'shippingBody',
] as const;

export type ProductCopyField = (typeof PRODUCT_COPY_FIELDS)[number];

/** Stored shape: each field is bilingual; absent fields fall back to i18n. */
export type ProductCopy = Partial<Record<ProductCopyField, { th?: string; en?: string }>>;

const Bilingual = z.object({ th: z.string().optional(), en: z.string().optional() });

/** Loose validation — only known fields are persisted by the action. */
export const ProductCopySchema = z.record(z.string(), Bilingual);
