import { describe, expect, it } from 'vitest';
import { parseEnv } from '@/lib/env';

describe('parseEnv', () => {
  it('parses a valid env object', () => {
    const parsed = parseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
      NODE_ENV: 'development',
    });
    expect(parsed.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
    expect(parsed.NODE_ENV).toBe('development');
  });

  it('rejects when required vars are missing', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('rejects malformed Supabase URL', () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'not-a-url',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-key',
        NODE_ENV: 'development',
      }),
    ).toThrowError(/url/i);
  });
});
