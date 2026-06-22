import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

/**
 * Global rate limit: 100 req/min per IP. Routes can opt into stricter limits via
 * their own `config.rateLimit` (e.g. /auth/* in a later phase).
 */
export const rateLimitPlugin = fp(
  async (fastify) => {
    await fastify.register(rateLimit, {
      global: true,
      max: 100,
      timeWindow: '1 minute',
      hook: 'onRequest',
      keyGenerator: (req) => req.ip,
    });
  },
  { name: 'rate-limit' },
);
