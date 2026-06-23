import { describe, expect, it } from 'vitest';
import {
  BCRYPT_COST,
  DEV_OTP,
  generateOtp,
  hashOtp,
  verifyOtp,
} from '../src/lib/otp-service.js';

describe('OTP service', () => {
  it('forces the dev OTP outside production', () => {
    expect(generateOtp('development')).toBe(DEV_OTP);
    expect(generateOtp('test')).toBe(DEV_OTP);
  });

  it('generates a random 6-digit code in production', () => {
    for (let i = 0; i < 50; i++) {
      const otp = generateOtp('production');
      expect(otp).toMatch(/^\d{6}$/);
      expect(Number(otp)).toBeGreaterThanOrEqual(100000);
      expect(Number(otp)).toBeLessThanOrEqual(999999);
    }
  });

  it('hashes the OTP (never stores plaintext) and verifies a correct code', async () => {
    const hash = await hashOtp('123456');
    expect(hash).not.toContain('123456');
    expect(hash.startsWith(`$2`)).toBe(true); // bcrypt prefix
    expect(await verifyOtp('123456', hash)).toBe(true);
  });

  it('rejects an incorrect code', async () => {
    const hash = await hashOtp('123456');
    expect(await verifyOtp('000000', hash)).toBe(false);
  });

  it('uses a bcrypt cost factor of at least 10', async () => {
    const hash = await hashOtp('654321');
    const cost = Number(hash.split('$')[2]);
    expect(cost).toBeGreaterThanOrEqual(10);
    expect(BCRYPT_COST).toBeGreaterThanOrEqual(10);
  });
});
