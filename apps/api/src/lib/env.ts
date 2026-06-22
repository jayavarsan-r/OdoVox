import { z } from 'zod';

/**
 * Environment validation. The server refuses to boot unless every required var is
 * present and well-formed. `parseEnv` is pure (testable); `loadEnv` reads process.env.
 */

const base64ToBytes = (s: string): number => {
  try {
    return Buffer.from(s, 'base64').length;
  } catch {
    return -1;
  }
};

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  DATABASE_URL: z.string().url().startsWith('postgres'),
  REDIS_URL: z.string().url().startsWith('redis'),

  JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY is required'),
  JWT_PUBLIC_KEY: z.string().min(1, 'JWT_PUBLIC_KEY is required'),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),

  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 chars'),

  PHI_ENCRYPTION_KEY: z
    .string()
    .refine((s) => base64ToBytes(s) === 32, 'PHI_ENCRYPTION_KEY must decode to exactly 32 bytes'),
  PHI_KEY_VERSION: z.coerce.number().int().min(1).default(1),

  SENTRY_DSN: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = EnvSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

let cached: Env | null = null;

export function loadEnv(): Env {
  if (!cached) {
    cached = parseEnv(process.env);
  }
  return cached;
}
