import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/lib/env.js';

/** A minimal valid raw env; provider knobs are layered on per-test. */
const baseRaw = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  PORT: '4000',
  CORS_ORIGINS: 'http://localhost:3000',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  JWT_PRIVATE_KEY: 'x',
  JWT_PUBLIC_KEY: 'y',
  JWT_ISSUER: 'odovox',
  JWT_AUDIENCE: 'odovox-web',
  COOKIE_SECRET: '0123456789abcdef0123456789abcdef',
  PHI_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  PHI_KEY_VERSION: '1',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'odovox',
  S3_SECRET_KEY: 'odovox-dev-password',
  S3_BUCKET: 'odovox-media',
  S3_FORCE_PATH_STYLE: 'true',
});

describe('real-provider env validation', () => {
  it('rejects STT_PROVIDER=sarvam without a SARVAM_API_KEY', () => {
    const raw = { ...baseRaw(), STT_PROVIDER: 'sarvam' };
    expect(() => parseEnv(raw)).toThrow(/SARVAM_API_KEY/);
  });

  it('rejects STT_PROVIDER=sarvam with a too-short key', () => {
    const raw = { ...baseRaw(), STT_PROVIDER: 'sarvam', SARVAM_API_KEY: 'short' };
    expect(() => parseEnv(raw)).toThrow(/SARVAM_API_KEY/);
  });

  it('rejects AI_PROVIDER=gemini without a GEMINI_API_KEY', () => {
    const raw = { ...baseRaw(), AI_PROVIDER: 'gemini' };
    expect(() => parseEnv(raw)).toThrow(/GEMINI_API_KEY/);
  });

  it('accepts real providers when both keys are present', () => {
    const raw = {
      ...baseRaw(),
      STT_PROVIDER: 'sarvam',
      SARVAM_API_KEY: 'sk_a_real_looking_key_value_123456',
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'AIza_a_real_looking_key_value_1234567890',
    };
    const env = parseEnv(raw);
    expect(env.STT_PROVIDER).toBe('sarvam');
    expect(env.AI_PROVIDER).toBe('gemini');
  });

  it('defaults GEMINI_MODEL to a free-tier-capable model (not the limit-0 2.0-flash)', () => {
    const env = parseEnv(baseRaw());
    expect(env.GEMINI_MODEL).toBe('gemini-2.5-flash');
  });
});
