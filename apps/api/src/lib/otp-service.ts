import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

/**
 * OTP generation, hashing, and verification. OTPs are never stored in plaintext — only a
 * bcrypt hash (cost 10) lives in the DB. In any non-production environment the code is
 * forced to a fixed value so testers know what to type (the mock sender prints it anyway).
 */

export const OTP_TTL_SECONDS = 600; // 10 minutes
export const OTP_RESEND_SECONDS = 60; // cooldown between requests for the same phone
export const OTP_MAX_ATTEMPTS = 5; // verify attempts before lockout
export const OTP_MAX_PER_HOUR = 5; // requests per phone per hour
export const OTP_MAX_PER_IP_PER_MINUTE = 3;
export const BCRYPT_COST = 10;

export const DEV_OTP = '123456';

/** Generate a 6-digit OTP. Forced to DEV_OTP outside production. */
export function generateOtp(nodeEnv = process.env.NODE_ENV): string {
  if (nodeEnv !== 'production') return DEV_OTP;
  // randomInt is [min, max) → yields 100000..999999.
  return String(crypto.randomInt(100000, 1000000));
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_COST);
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}
