import { describe, expect, it } from 'vitest';
import { slugify } from '@/domain/slugify';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Summer Tee')).toBe('summer-tee');
  });

  it('strips non-alphanumerics except hyphens', () => {
    expect(slugify("Bunny's Hoodie! 2026")).toBe('bunnys-hoodie-2026');
  });

  it('collapses runs of hyphens', () => {
    expect(slugify('a   b -- c')).toBe('a-b-c');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  —hello—  ')).toBe('hello');
  });

  it('transliterates basic accents', () => {
    expect(slugify('Café')).toBe('cafe');
  });

  it('falls back to provided string for unsupportable input', () => {
    expect(slugify('ภาษาไทย', { fallback: 'product-abc123' })).toBe('product-abc123');
  });

  it('returns empty when input is empty and no fallback given', () => {
    expect(slugify('')).toBe('');
  });
});
