import 'fastify';
import type { Redis } from 'ioredis';
import type { ExtendedPrismaClient } from '../plugins/prisma.js';

type AuditFn = (
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
) => Promise<void>;

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; phone: string };
    clinicId?: string;
    role?: 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN';
  }

  interface FastifyInstance {
    prisma: ExtendedPrismaClient;
    redis: Redis;
    audit: AuditFn;
  }
}
