import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import type { Env } from '../lib/env.js';

/**
 * CORS with a strict origin allowlist from CORS_ORIGINS. Credentials enabled so the
 * httpOnly refresh cookie flows. Requests from unknown origins are rejected.
 */
export const corsPlugin = fp(
  async (fastify, opts: { env: Env }) => {
    const allowlist = new Set(opts.env.CORS_ORIGINS);

    await fastify.register(cors, {
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      origin: (origin, cb) => {
        // Same-origin / server-to-server requests have no Origin header.
        if (!origin) {
          cb(null, true);
          return;
        }
        if (allowlist.has(origin)) {
          cb(null, true);
          return;
        }
        cb(new Error('Not allowed by CORS'), false);
      },
    });
  },
  { name: 'cors' },
);
