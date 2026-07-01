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

  // S3-compatible object storage (MinIO in dev, S3/R2/Wasabi in prod).
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1).default('odovox-media'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),

  // OTP delivery. `mock` logs the code to the console (dev); `msg91` sends a real SMS.
  OTP_PROVIDER: z.enum(['mock', 'msg91']).default('mock'),
  MSG91_AUTH_KEY: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  MSG91_TEMPLATE_ID: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  MSG91_SENDER_ID: z.string().optional().or(z.literal('')).transform((v) => v || undefined),

  // STT (speech-to-text). `mock` returns a deterministic canned transcript (dev/tests);
  // `sarvam` calls the real Sarvam speech-to-text API. See docs/voice-pipeline.md.
  STT_PROVIDER: z.enum(['mock', 'sarvam']).default('mock'),
  SARVAM_API_KEY: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  SARVAM_MODEL: z.string().min(1).default('saarika:v2.5'),

  // AI extraction. `mock` pattern-matches keywords (dev/tests); `gemini` calls Gemini Flash.
  // Default model is gemini-2.5-flash: gemini-2.0-flash has a free-tier request limit of 0 (an
  // un-billed key gets HTTP 429 RESOURCE_EXHAUSTED on every call), whereas 2.5-flash works on the
  // free tier. We disable its "thinking" in the extractor so the JSON never truncates.
  AI_PROVIDER: z.enum(['mock', 'gemini']).default('mock'),
  GEMINI_API_KEY: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),

  // Payments. `mock` returns deterministic payment links / webhooks (dev/tests); `razorpay` calls
  // the real Razorpay API (test or live mode). Same provider-abstraction pattern as STT/AI.
  PAYMENT_PROVIDER: z.enum(['mock', 'razorpay']).default('mock'),
  RAZORPAY_KEY_ID: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  RAZORPAY_KEY_SECRET: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  RAZORPAY_MODE: z.enum(['test', 'live']).default('test'),
  // Mock-gateway chaos knob: fraction (0..1) of created links that simulate a FAILED payment.
  PAYMENT_MOCK_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0),

  // WhatsApp (Phase 9). `mock` returns deterministic sends/webhooks (dev/tests); `aisensy` calls the
  // real AiSensy WhatsApp Business API. Same provider-abstraction pattern as STT/AI/Payments.
  WHATSAPP_PROVIDER: z.enum(['mock', 'aisensy']).default('mock'),
  AISENSY_API_KEY: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  AISENSY_WEBHOOK_SECRET: z.string().optional().or(z.literal('')).transform((v) => v || undefined),
  AISENSY_BASE_URL: z.string().url().default('https://backend.aisensy.com'),
  // Mock-provider chaos knob: fraction (0..1) of sends that simulate a FAILED delivery.
  MOCK_WHATSAPP_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0),

  SENTRY_DSN: z.string().url().optional().or(z.literal('')).transform((v) => v || undefined),
})
  .refine(
    (env) => env.OTP_PROVIDER !== 'msg91' || (!!env.MSG91_AUTH_KEY && !!env.MSG91_TEMPLATE_ID),
    {
      message: 'MSG91_AUTH_KEY and MSG91_TEMPLATE_ID are required when OTP_PROVIDER=msg91',
      path: ['OTP_PROVIDER'],
    },
  )
  .refine((env) => env.STT_PROVIDER !== 'sarvam' || (env.SARVAM_API_KEY?.length ?? 0) >= 20, {
    message: 'SARVAM_API_KEY is required and must be non-empty when STT_PROVIDER=sarvam',
    path: ['SARVAM_API_KEY'],
  })
  .refine((env) => env.AI_PROVIDER !== 'gemini' || (env.GEMINI_API_KEY?.length ?? 0) >= 20, {
    message: 'GEMINI_API_KEY is required and must be non-empty when AI_PROVIDER=gemini',
    path: ['GEMINI_API_KEY'],
  })
  .refine(
    (env) =>
      env.PAYMENT_PROVIDER !== 'razorpay' ||
      (!!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET && !!env.RAZORPAY_WEBHOOK_SECRET),
    {
      message:
        'RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET are required when PAYMENT_PROVIDER=razorpay',
      path: ['PAYMENT_PROVIDER'],
    },
  )
  .refine(
    (env) =>
      env.WHATSAPP_PROVIDER !== 'aisensy' ||
      (!!env.AISENSY_API_KEY && !!env.AISENSY_WEBHOOK_SECRET),
    {
      message: 'AISENSY_API_KEY and AISENSY_WEBHOOK_SECRET are required when WHATSAPP_PROVIDER=aisensy',
      path: ['WHATSAPP_PROVIDER'],
    },
  );

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
