import { describe, expect, it } from 'vitest';
import { resolveTheme } from '@/lib/theme';

describe('resolveTheme', () => {
  it('honors an explicit stored choice over the system preference', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('follows the system preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('treats garbage storage values as unset', () => {
    expect(resolveTheme('solarized', true)).toBe('dark');
    expect(resolveTheme('', false)).toBe('light');
  });
});
