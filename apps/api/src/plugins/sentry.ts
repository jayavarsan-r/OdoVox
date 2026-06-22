import fp from 'fastify-plugin';
import * as Sentry from '@sentry/node';
import type { Env } from '../lib/env.js';

/**
 * Initializes Sentry if SENTRY_DSN is provided. Must never crash the server when
 * the DSN is absent (it simply runs as a no-op). Captures unhandled errors.
 */
export const sentryPlugin = fp(
  async (fastify, opts: { env: Env }) => {
    const { env } = opts;
    if (!env.SENTRY_DSN) {
      fastify.log.info('Sentry disabled (no DSN configured)');
      return;
    }

    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV,
      tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
    });

    fastify.addHook('onError', async (_req, _reply, error) => {
      Sentry.captureException(error);
    });

    fastify.addHook('onClose', async () => {
      await Sentry.flush(2000);
    });

    fastify.log.info('Sentry initialized');
  },
  { name: 'sentry' },
);
