import { config as loadDotenv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadEnv } from './lib/env.js';
import { buildLoggerOptions } from './lib/logger.js';
import { errorHandler } from './lib/errors.js';
import { enterContext } from './lib/request-context.js';
import { sentryPlugin } from './plugins/sentry.js';
import { helmetPlugin } from './plugins/helmet.js';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { cookiePlugin } from './plugins/cookie.js';
import { jwtPlugin } from './plugins/jwt.js';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { auditPlugin } from './plugins/audit.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { clinicRoutes } from './routes/clinics.js';

// Load .env in non-production (repo root).
if (process.env.NODE_ENV !== 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  loadDotenv({ path: path.resolve(__dirname, '../../../.env') });
}

export async function buildServer(): Promise<FastifyInstance> {
  const env = loadEnv();

  const app = Fastify({
    logger: buildLoggerOptions(env),
    trustProxy: true,
    disableRequestLogging: false,
    genReqId: () => crypto.randomUUID(),
  });

  app.setErrorHandler(errorHandler);

  // Establish per-request AsyncLocalStorage context early so Prisma clinic-scoping
  // and audit attribution have ip/userAgent (and later, clinicId/userId from auth).
  app.addHook('onRequest', async (req) => {
    enterContext({
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  });

  // Plugin order: sentry → logger(via Fastify) → helmet → cors → rate-limit →
  // cookie → jwt → prisma → redis → audit → routes.
  await app.register(sentryPlugin, { env });
  await app.register(helmetPlugin);
  await app.register(corsPlugin, { env });
  await app.register(rateLimitPlugin);
  await app.register(cookiePlugin, { env });
  await app.register(jwtPlugin, { env });
  await app.register(prismaPlugin);
  await app.register(redisPlugin, { env });
  await app.register(auditPlugin);

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(clinicRoutes);

  return app;
}

async function start(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down…`);
    try {
      await app.close(); // closes server + triggers onClose (prisma, redis, sentry flush)
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Only auto-start when run directly (not when imported by tests).
const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  void start();
}
