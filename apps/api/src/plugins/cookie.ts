import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import type { Env } from '../lib/env.js';

/** Signed cookie support for the httpOnly refresh-token cookie. */
export const cookiePlugin = fp(
  async (fastify, opts: { env: Env }) => {
    await fastify.register(cookie, {
      secret: opts.env.COOKIE_SECRET,
      parseOptions: {
        httpOnly: true,
        secure: opts.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      },
    });
  },
  { name: 'cookie' },
);
