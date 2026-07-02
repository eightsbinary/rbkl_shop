import * as z from 'zod';

/** Every editable text field in the homepage hero. */
export const HOME_FIELDS = ['heroLine1', 'heroLine2', 'heroSubtitle', 'heroCta'] as const;

export type HomeField = (typeof HOME_FIELDS)[number];

/** Stored shape: each field is bilingual; absent fields fall back to i18n. */
export type HomeContent = Partial<Record<HomeField, { th?: string; en?: string }>>;

const Bilingual = z.object({ th: z.string().optional(), en: z.string().optional() });

/** Loose validation — only known fields are persisted by the action. */
export const HomeContentSchema = z.record(z.string(), Bilingual);

/** The hero image shipped in /public — shown until an admin picks an upload. */
export const DEFAULT_HOME_HERO_IMAGE = '/hero.png';

/** Hero image selection: a storage path in home/, or null → default. */
export const HomeImageInputSchema = z.union([z.string().regex(/^home\/[\w.-]+$/), z.null()]);
