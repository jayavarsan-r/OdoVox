import fp from 'fastify-plugin';
import { getContext } from '../lib/request-context.js';

/**
 * Decorates `fastify.audit(action, entityType, entityId?, metadata?)` for explicit,
 * semantic audit entries from route handlers (e.g. "OTP_VERIFIED", "PATIENT_EXPORTED").
 * The Prisma audit middleware already records raw mutations; this captures intent.
 *
 * Depends on the prisma plugin being registered first.
 */
export const auditPlugin = fp(
  async (fastify) => {
    fastify.decorate(
      'audit',
      async (
        action: string,
        entityType: string,
        entityId?: string | null,
        metadata: Record<string, unknown> = {},
      ): Promise<void> => {
        const ctx = getContext();
        await fastify.prisma.auditLog.create({
          data: {
            clinicId: ctx?.clinicId ?? null,
            userId: ctx?.userId ?? null,
            action,
            entityType,
            entityId: entityId ?? null,
            metadata: metadata as object,
            ip: ctx?.ip ?? null,
            userAgent: ctx?.userAgent ?? null,
          },
        });
      },
    );
  },
  { name: 'audit', dependencies: ['prisma'] },
);
