export interface SlugifyOptions {
  readonly fallback?: string;
}

export function slugify(input: string, opts: SlugifyOptions = {}): string {
  const slug = input
    .normalize('NFKD')
    // biome-ignore lint/suspicious/noMisleadingCharacterClass: stripping diacritics from NFKD output
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`"]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length === 0 && opts.fallback) return opts.fallback;
  return slug;
}
