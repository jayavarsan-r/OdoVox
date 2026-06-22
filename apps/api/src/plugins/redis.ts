import fp from 'fastify-plugin';
import { Redis } from 'ioredis';
import type { Env } from '../lib/env.js';

/** ioredis singleton with a ping health check on boot. */
export const redisPlugin = fp(
  async (fastify, opts: { env: Env }) => {
    const redis = new Redis(opts.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    await redis.connect();
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis health check failed on boot');
    }

    fastify.decorate('redis', redis);

    fastify.addHook('onClose', async () => {
      await redis.quit();
    });

    fastify.log.info('Redis connected');
  },
  { name: 'redis' },
);
