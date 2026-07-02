import * as z from 'zod';

/** Every editable field on the About page. Order here drives the admin editor. */
export const ABOUT_FIELDS = [
  'heroTitle',
  'heroBody1',
  'heroBody2',
  'craftTitle',
  'craftSubtitle',
  'craftCaption',
  'card1Title',
  'card1Body',
  'card2Title',
  'card2Body',
  'inspirationLabel',
  'inspirationTitle',
  'inspirationBody1',
  'inspirationBody2',
] as const;

export type AboutField = (typeof ABOUT_FIELDS)[number];

/** Stored shape: each field is bilingual. Any field may be absent (falls back
 *  to the i18n default on the page). */
export type AboutContent = Partial<Record<AboutField, { th?: string; en?: string }>>;

/** Section grouping for the admin editor. */
export const ABOUT_GROUPS: { key: 'hero' | 'craft' | 'inspiration'; fields: AboutField[] }[] = [
  { key: 'hero', fields: ['heroTitle', 'heroBody1', 'heroBody2'] },
  {
    key: 'craft',
    fields: [
      'craftTitle',
      'craftSubtitle',
      'craftCaption',
      'card1Title',
      'card1Body',
      'card2Title',
      'card2Body',
    ],
  },
  {
    key: 'inspiration',
    fields: ['inspirationLabel', 'inspirationTitle', 'inspirationBody1', 'inspirationBody2'],
  },
];

const Bilingual = z.object({ th: z.string().optional(), en: z.string().optional() });

/** Loose validation — only known fields are persisted by the action. */
export const AboutContentSchema = z.record(z.string(), Bilingual);

/** Sections with a selectable photo (admin-managed, about-assets bucket). */
export const ABOUT_IMAGE_SECTIONS = ['hero', 'craft', 'inspiration'] as const;

export type AboutImageSection = (typeof ABOUT_IMAGE_SECTIONS)[number];

/** Stored shape: section → storage path. A missing key means the section uses
 *  its built-in default below. */
export type AboutImages = Partial<Record<AboutImageSection, string>>;

/** The images shipped in /public — what every section shows until an admin
 *  selects an upload. */
export const DEFAULT_ABOUT_IMAGES: Record<AboutImageSection, string> = {
  hero: '/about-hero.png',
  craft: '/about-craft.png',
  inspiration: '/about-inspiration.png',
};

/** Selection payload: a storage path in about/, or null to reset to default. */
export const AboutImagesInputSchema = z
  .object(
    Object.fromEntries(
      ABOUT_IMAGE_SECTIONS.map((s) => [
        s,
        z.union([z.string().regex(/^about\/[\w.-]+$/), z.null()]).optional(),
      ]),
    ) as Record<AboutImageSection, z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNull]>>>,
  )
  .strict();

export type AboutImagesInput = z.infer<typeof AboutImagesInputSchema>;
