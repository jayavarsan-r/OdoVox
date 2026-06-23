import crypto from 'node:crypto';

/**
 * Refresh tokens are opaque random strings. We store only their SHA-256 hash in the
 * RefreshToken table (never the plaintext), and rotate them on every use.
 */

export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
export const REFRESH_COOKIE_NAME = 'odovox_rt';
export const REFRESH_COOKIE_PATH = '/auth';

/** Generate a fresh opaque refresh-token value (URL-safe). */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/** SHA-256 hex hash of a refresh token, used as the unique DB lookup key. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TTL_SECONDS * 1000);
}
