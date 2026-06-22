import type { FastifyInstance } from 'fastify';

const VERSION = process.env.npm_package_version ?? '0.0.0';
const startedAt = Date.now();

/**
 * GET /health — liveness + dependency check for load balancers and smoke tests.
 * Returns 200 when healthy, 503 if any dependency is down.
 */
export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_req, reply) => {
    let db: 'ok' | 'error' = 'ok';
    let redis: 'ok' | 'error' = 'ok';

    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }

    try {
      const pong = await fastify.redis.ping();
      redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      redis = 'error';
    }

    const healthy = db === 'ok' && redis === 'ok';
    reply.status(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      db,
      redis,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      version: VERSION,
    });
  });
}
