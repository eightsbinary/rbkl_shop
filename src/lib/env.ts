import * as z from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  // Treat empty/whitespace-only values as unset. `.env` files and many hosts
  // materialise "declared but blank" vars as "" rather than omitting them, and
  // "" is not `undefined` — so without this, an empty optional var (e.g. a blank
  // UPSTASH_REDIS_REST_URL placeholder) would fail .url()/.min(1) instead of
  // falling back to its dev default.
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = value !== undefined && value.trim() === '' ? undefined : value;
  }
  const result = EnvSchema.safeParse(normalized);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}

let cached: Env | null = null;

/** Lazy singleton accessor for app code. Throws on first call if env is invalid. */
export function env(): Env {
  if (cached) return cached;
  cached = parseEnv(process.env as Record<string, string | undefined>);
  return cached;
}
