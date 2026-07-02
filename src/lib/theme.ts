export type Theme = 'light' | 'dark';

/** localStorage key for the visitor's explicit theme choice. */
export const THEME_STORAGE_KEY = 'rb-theme';

/** An explicit stored choice wins; anything else follows the system preference. */
export function resolveTheme(stored: string | null, systemDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemDark ? 'dark' : 'light';
}
