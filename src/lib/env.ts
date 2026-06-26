import * as z from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const result = EnvSchema.safeParse(raw);
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
