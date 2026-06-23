import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanup, randomIp, randomPhone } from './helpers.js';

let app: FastifyInstance;
const phones: string[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await cleanup(app, { phones });
  await app.close();
});

function track(p: string): string {
  phones.push(p);
  return p;
}

describe('POST /auth/otp/request', () => {
  it('returns expiry + resend windows and never the code', async () => {
    const phone = track(randomPhone());
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/request',
      headers: { 'x-forwarded-for': randomIp() },
      payload: { phone },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({ expiresInSeconds: 600, resendInSeconds: 60 });
    expect(JSON.stringify(body)).not.toContain('123456');
  });

  it('enforces a 60s cooldown for the same phone', async () => {
    const phone = track(randomPhone());
    const ip = randomIp();
    await app.inject({ method: 'POST', url: '/auth/otp/request', headers: { 'x-forwarded-for': ip }, payload: { phone } });
    const second = await app.inject({
      method: 'POST',
      url: '/auth/otp/request',
      headers: { 'x-forwarded-for': ip },
      payload: { phone },
    });
    expect(second.statusCode).toBe(429);
    expect(second.json().error.code).toBe('OTP_COOLDOWN_ACTIVE');
    expect(second.json().error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('rate-limits to 3 requests per IP per minute (4th → 429)', async () => {
    const ip = randomIp();
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/otp/request',
        headers: { 'x-forwarded-for': ip },
        payload: { phone: track(randomPhone()) },
      });
      codes.push(res.statusCode);
    }
    expect(codes.slice(0, 3).every((c) => c === 200)).toBe(true);
    expect(codes[3]).toBe(429);
  });
});

describe('POST /auth/otp/verify', () => {
  it('verifies the dev code, issues tokens, and routes a new user to ROLE_SELECT', async () => {
    const phone = track(randomPhone());
    const ip = randomIp();
    await app.inject({ method: 'POST', url: '/auth/otp/request', headers: { 'x-forwarded-for': ip }, payload: { phone } });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      headers: { 'x-forwarded-for': ip },
      payload: { phone, otp: '123456' },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.accessToken).toBeTruthy();
    expect(data.expiresIn).toBe(900);
    expect(data.activeMembership).toBeNull();
    expect(data.nextStep).toBe('ROLE_SELECT');
    expect(res.cookies.some((c) => c.name === 'odovox_rt' && c.httpOnly && c.path === '/auth')).toBe(true);
  });

  it('rejects a wrong code and reports remaining attempts', async () => {
    const phone = track(randomPhone());
    const ip = randomIp();
    await app.inject({ method: 'POST', url: '/auth/otp/request', headers: { 'x-forwarded-for': ip }, payload: { phone } });
    const res = await app.inject({
      method: 'POST',
      url: '/auth/otp/verify',
      headers: { 'x-forwarded-for': ip },
      payload: { phone, otp: '000000' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('OTP_INCORRECT');
    expect(res.json().error.details.attemptsRemaining).toBe(4);
  });

  it('locks the code after 5 failed attempts', async () => {
    const phone = track(randomPhone());
    const ip = randomIp();
    await app.inject({ method: 'POST', url: '/auth/otp/request', headers: { 'x-forwarded-for': ip }, payload: { phone } });
    let last;
    for (let i = 0; i < 6; i++) {
      last = await app.inject({
        method: 'POST',
        url: '/auth/otp/verify',
        headers: { 'x-forwarded-for': ip },
        payload: { phone, otp: '111111' },
      });
    }
    expect(last!.statusCode).toBe(429);
    expect(last!.json().error.code).toBe('OTP_LOCKED');
  });
});
