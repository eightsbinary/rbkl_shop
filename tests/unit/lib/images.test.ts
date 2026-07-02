import { describe, expect, it } from 'vitest';
import { computeTargetSize, IMAGE_SIZES } from '@/lib/images';

describe('computeTargetSize', () => {
  it('preserves aspect ratio when shrinking', () => {
    expect(computeTargetSize({ width: 2000, height: 1000 }, 800)).toEqual({
      width: 800,
      height: 400,
    });
  });

  it('does not upscale smaller images', () => {
    expect(computeTargetSize({ width: 500, height: 250 }, 800)).toEqual({
      width: 500,
      height: 250,
    });
  });

  it('rounds dimensions to integers', () => {
    expect(computeTargetSize({ width: 1234, height: 567 }, 800)).toEqual({
      width: 800,
      height: 368,
    });
  });
});

describe('IMAGE_SIZES', () => {
  it('exposes 400/800/1600 ladder', () => {
    expect(IMAGE_SIZES).toEqual([400, 800, 1600]);
  });
});
