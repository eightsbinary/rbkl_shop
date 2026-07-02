import { describe, expect, it } from 'vitest';
import { buildAppearanceCss, HEX_COLOR } from '@/domain/site-appearance';

describe('buildAppearanceCss', () => {
  it('returns an empty string when nothing is overridden', () => {
    expect(buildAppearanceCss({ bgLight: null, bgDark: null })).toBe('');
  });

  it('emits only the overridden theme', () => {
    expect(buildAppearanceCss({ bgLight: '#fff7ef', bgDark: null })).toBe(
      ':root{--color-paper:#fff7ef}',
    );
    expect(buildAppearanceCss({ bgLight: null, bgDark: '#0a0a14' })).toBe(
      ":root[data-theme='dark']{--color-paper:#0a0a14}",
    );
  });

  it('emits both rules when both are set', () => {
    expect(buildAppearanceCss({ bgLight: '#fff7ef', bgDark: '#0a0a14' })).toBe(
      ":root{--color-paper:#fff7ef}:root[data-theme='dark']{--color-paper:#0a0a14}",
    );
  });

  it('drops values that are not lowercase #rrggbb hex (CSS-injection guard)', () => {
    expect(buildAppearanceCss({ bgLight: 'red;}body{display:none', bgDark: '#FFF7EF' })).toBe('');
    expect(buildAppearanceCss({ bgLight: '#abc', bgDark: '#12345g' })).toBe('');
  });
});

describe('HEX_COLOR', () => {
  it('accepts lowercase #rrggbb and nothing else', () => {
    expect(HEX_COLOR.test('#a1b2c3')).toBe(true);
    expect(HEX_COLOR.test('#A1B2C3')).toBe(false);
    expect(HEX_COLOR.test('#abc')).toBe(false);
    expect(HEX_COLOR.test('a1b2c3')).toBe(false);
    expect(HEX_COLOR.test('#a1b2c3 ')).toBe(false);
  });
});
