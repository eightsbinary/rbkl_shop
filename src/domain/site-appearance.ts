/** Admin-managed storefront appearance overrides (null → built-in palette). */
export interface SiteAppearance {
  bgLight: string | null;
  bgDark: string | null;
}

/** Lowercase #rrggbb only — enforced on save and re-checked before rendering CSS. */
export const HEX_COLOR = /^#[0-9a-f]{6}$/;

/** Built-in `--color-paper` values — keep in sync with src/app/globals.css. */
export const DEFAULT_BG = { light: '#fbfbfa', dark: '#121212' } as const;

/** Inline-<style> body overriding the page background token per theme.
 *  Empty string when nothing is overridden (render no style tag). */
export function buildAppearanceCss(appearance: SiteAppearance): string {
  const parts: string[] = [];
  if (appearance.bgLight && HEX_COLOR.test(appearance.bgLight)) {
    parts.push(`:root{--color-paper:${appearance.bgLight}}`);
  }
  if (appearance.bgDark && HEX_COLOR.test(appearance.bgDark)) {
    parts.push(`:root[data-theme='dark']{--color-paper:${appearance.bgDark}}`);
  }
  return parts.join('');
}
