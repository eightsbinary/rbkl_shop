import { describe, expect, it } from 'vitest';
import { buildTrackingUrl, CARRIERS, type CarrierKey } from '@/domain/carriers';

const KEYS: CarrierKey[] = ['thailand_post', 'kerry', 'flash', 'jnt', 'dhl', 'fedex', 'ups'];

describe('CARRIERS registry', () => {
  it('defines all seven supported carriers with labels', () => {
    expect(Object.keys(CARRIERS).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      expect(CARRIERS[key].label.length).toBeGreaterThan(0);
    }
  });
});

describe('buildTrackingUrl', () => {
  it.each(KEYS)('builds a tracking URL for %s containing the number', (key) => {
    const url = buildTrackingUrl(key, 'TH123456789');
    expect(url).not.toBeNull();
    expect(url).toContain('TH123456789');
    expect(url).toMatch(/^https:\/\//);
  });

  it('returns null for an unknown carrier', () => {
    expect(buildTrackingUrl('owl_post', 'X1')).toBeNull();
  });

  it('url-encodes tracking numbers with special characters', () => {
    const url = buildTrackingUrl('thailand_post', 'AB 12/34&56');
    expect(url).not.toBeNull();
    expect(url).toContain(encodeURIComponent('AB 12/34&56'));
    expect(url).not.toContain('AB 12/34&56');
  });
});
