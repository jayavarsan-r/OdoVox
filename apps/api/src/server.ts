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
import { socketPlugin } from './plugins/socket.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { clinicRoutes } from './routes/clinics.js';
import { patientRoutes } from './routes/patients.js';
import { clinicalRoutes } from './routes/clinical.js';
import { mediaRoutes } from './routes/media.js';
import { homeRoutes } from './routes/home.js';
import { consultationRoutes } from './routes/consultations.js';
import { dictateRoutes } from './routes/dictate.js';
import { queueRoutes } from './routes/queue.js';
import { prescriptionTemplateRoutes } from './routes/prescription-templates.js';
import { scheduleRoutes } from './routes/schedule.js';
import { preflight } from './lib/preflight.js';
import { printBootBanner } from './lib/boot-banner.js';
import { startWorkers } from './queues/start-workers.js';
import { startScheduleCron } from './queues/schedule-cron.js';
import { closeQueues } from './queues/index.js';

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
  await app.register(socketPlugin, { env });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(clinicRoutes);
  await app.register(patientRoutes);
  await app.register(clinicalRoutes);
  await app.register(mediaRoutes);
  await app.register(homeRoutes);
  await app.register(consultationRoutes);
  await app.register(dictateRoutes);
  await app.register(queueRoutes);
  await app.register(prescriptionTemplateRoutes);
  await app.register(scheduleRoutes);

  return app;
}

async function start(): Promise<void> {
  const env = loadEnv();
  const app = await buildServer();

  let workers: { stop: () => Promise<void> } | null = null;
  let scheduleCron: { stop: () => Promise<void> } | null = null;

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down…`);
    try {
      await workers?.stop(); // drain in-process voice workers first
      await scheduleCron?.stop();
      await closeQueues();
      await app.close(); // closes server + triggers onClose (prisma, redis, sentry flush)
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Fail loud at boot if Postgres / Redis / the PHI key are misconfigured.
  await preflight(app);

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
    // Start the in-process STT + extraction workers (Phase 10 may split these out).
    workers = startWorkers(app);
    // Repeating NO_SHOW sweep (every 5 min). Only here in start() → never under tests.
    scheduleCron = startScheduleCron(app);
    // Make the active STT / AI / OTP providers impossible to miss at boot.
    printBootBanner(env);
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
