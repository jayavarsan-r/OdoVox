import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

/**
 * Security headers: strict CSP, HSTS (1 year), and X-Powered-By removed.
 * Fastify does not send X-Powered-By by default; helmet's hidePoweredBy keeps it off.
 */
export const helmetPlugin = fp(
  async (fastify) => {
    await fastify.register(helmet, {
      hidePoweredBy: true,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:'],
          formAction: ["'self'"],
        },
      },
      hsts: {
        maxAge: 60 * 60 * 24 * 365, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'no-referrer' },
    });
  },
  { name: 'helmet' },
);
