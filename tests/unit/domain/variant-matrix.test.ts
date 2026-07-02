import { describe, expect, it } from 'vitest';
import { generateVariants, type VariantAxis } from '@/domain/variant-matrix';

const axes: VariantAxis[] = [
  { name: 'size', values: ['S', 'M', 'L'] },
  { name: 'color', values: ['cream', 'sand'] },
];

describe('generateVariants', () => {
  it('produces the cartesian product as variant draft rows', () => {
    const variants = generateVariants(axes);
    expect(variants).toHaveLength(6);
    expect(variants[0]).toEqual({ optionValues: { size: 'S', color: 'cream' } });
    expect(variants[5]).toEqual({ optionValues: { size: 'L', color: 'sand' } });
  });

  it('returns single-row matrix for one axis', () => {
    const v = generateVariants([{ name: 'size', values: ['One Size'] }]);
    expect(v).toEqual([{ optionValues: { size: 'One Size' } }]);
  });

  it('returns empty array for empty axes', () => {
    expect(generateVariants([])).toEqual([]);
  });

  it('returns empty when any axis has no values', () => {
    expect(generateVariants([{ name: 'size', values: [] }])).toEqual([]);
  });
});
