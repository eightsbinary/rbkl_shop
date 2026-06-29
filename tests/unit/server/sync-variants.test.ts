import { describe, expect, it } from 'vitest';
import { diffVariants } from '@/domain/variant-matrix';

const ov = (size: string) => ({ size });

describe('diffVariants', () => {
  it('keeps matched, adds new, removes missing — by option_values', () => {
    const existing = [
      { id: 'a', option_values: ov('S') },
      { id: 'b', option_values: ov('M') },
    ];
    const desired = [ov('M'), ov('L')];
    const r = diffVariants(existing, desired);
    expect(r.keep.map((k) => k.id)).toEqual(['b']);
    expect(r.add).toEqual([ov('L')]);
    expect(r.removeIds).toEqual(['a']);
  });
});
