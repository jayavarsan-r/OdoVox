import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, cleanup, randomIp, signIn } from './helpers.js';

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

function cookieFrom(res: { cookies: Array<{ name: string; value: string }> }): string {
  const c = res.cookies.find((x) => x.name === 'odovox_rt');
  return c ? `${c.name}=${c.value}` : '';
}

describe('POST /auth/refresh — rotation', () => {
  it('issues a new access token and rotates the refresh token', async () => {
    const session = await signIn(app);
    phones.push(session.phone);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: session.refreshCookie, 'x-forwarded-for': randomIp() },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.accessToken).toBeTruthy();
    expect(res.json().data.expiresIn).toBe(900);
    const rotated = cookieFrom(res);
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(session.refreshCookie);
  });

  it('rejects reuse of the old (rotated-out) refresh token', async () => {
    const session = await signIn(app);
    phones.push(session.phone);

    const first = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: session.refreshCookie },
    });
    expect(first.statusCode).toBe(200);

    // The original cookie is now revoked.
    const reuse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: session.refreshCookie },
    });
    expect(reuse.statusCode).toBe(401);
  });

  it('401s when no refresh cookie is present', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/refresh' });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the refresh token so subsequent refresh fails', async () => {
    const session = await signIn(app);
    phones.push(session.phone);

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { cookie: session.refreshCookie },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json().data.logoutAt).toBeTruthy();

    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: session.refreshCookie },
    });
    expect(refresh.statusCode).toBe(401);
  });
});
