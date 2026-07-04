import { describe, expect, it } from 'vitest';
import { type ProductCopy, pickCopy } from '@/domain/product-copy';

const site: ProductCopy = {
  detailsTitle: { th: 'รายละเอียด (ร้าน)', en: 'Details (site)' },
  shippingBody: { en: 'Ships in 3 days' },
};

describe('pickCopy', () => {
  it('prefers the per-product override over the site-wide copy', () => {
    const product: ProductCopy = { detailsTitle: { en: 'Care & fabric' } };
    expect(pickCopy(product, site, 'detailsTitle', 'en')).toBe('Care & fabric');
  });

  it('falls back to the site-wide copy when the product has no override', () => {
    expect(pickCopy({}, site, 'detailsTitle', 'en')).toBe('Details (site)');
    expect(pickCopy(null, site, 'detailsTitle', 'th')).toBe('รายละเอียด (ร้าน)');
  });

  it('falls back per locale — a TH-only override still uses site copy for EN', () => {
    const product: ProductCopy = { detailsTitle: { th: 'ผ้าและการดูแล' } };
    expect(pickCopy(product, site, 'detailsTitle', 'th')).toBe('ผ้าและการดูแล');
    expect(pickCopy(product, site, 'detailsTitle', 'en')).toBe('Details (site)');
  });

  it('treats blank/whitespace overrides as absent', () => {
    const product: ProductCopy = { detailsTitle: { en: '   ' } };
    expect(pickCopy(product, site, 'detailsTitle', 'en')).toBe('Details (site)');
  });

  it('returns null when neither layer has the field (caller falls back to i18n)', () => {
    expect(pickCopy(null, site, 'shippingTitle', 'en')).toBeNull();
    expect(pickCopy({}, {}, 'detailsBody', 'th')).toBeNull();
  });
});
