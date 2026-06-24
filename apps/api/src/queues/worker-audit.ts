import type { ExtendedPrismaClient } from '../plugins/prisma.js';

/**
 * Workers run outside any request context, so they can't use `fastify.audit` (which reads the
 * request ALS). This writes the audit row directly with an explicit clinicId — the safety/legal
 * trail for every pipeline step.
 */
export async function writeWorkerAudit(
  prisma: ExtendedPrismaClient,
  clinicId: string,
  action: string,
  consultationId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      clinicId,
      userId: null,
      action,
      entityType: 'Consultation',
      entityId: consultationId,
      metadata: metadata as object,
      ip: null,
      userAgent: null,
    },
  });
}
