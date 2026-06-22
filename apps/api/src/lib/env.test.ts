import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { parseEnv } from './env.js';

const validRaw = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  LOG_LEVEL: 'info',
  PORT: '4000',
  CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  JWT_PRIVATE_KEY: 'x',
  JWT_PUBLIC_KEY: 'y',
  JWT_ISSUER: 'odovox',
  JWT_AUDIENCE: 'odovox-web',
  COOKIE_SECRET: '0123456789abcdef0123456789abcdef',
  PHI_ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
  PHI_KEY_VERSION: '1',
  SENTRY_DSN: '',
});

describe('parseEnv', () => {
  it('accepts a valid environment and splits CORS_ORIGINS', () => {
    const env = parseEnv(validRaw());
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it('rejects a missing PHI_ENCRYPTION_KEY', () => {
    const raw = validRaw();
    delete raw.PHI_ENCRYPTION_KEY;
    expect(() => parseEnv(raw)).toThrow(/PHI_ENCRYPTION_KEY/);
  });

  it('rejects a PHI key that is not 32 bytes', () => {
    const raw = validRaw();
    raw.PHI_ENCRYPTION_KEY = crypto.randomBytes(16).toString('base64');
    expect(() => parseEnv(raw)).toThrow(/32 bytes/);
  });

  it('rejects a malformed DATABASE_URL', () => {
    const raw = validRaw();
    raw.DATABASE_URL = 'not-a-url';
    expect(() => parseEnv(raw)).toThrow();
  });

  it('rejects a too-short COOKIE_SECRET', () => {
    const raw = validRaw();
    raw.COOKIE_SECRET = 'short';
    expect(() => parseEnv(raw)).toThrow(/COOKIE_SECRET/);
  });
});
