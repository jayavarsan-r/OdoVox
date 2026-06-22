import fp from 'fastify-plugin';
import { PrismaClient, type Prisma, isClinicScopedModel } from '@odovox/db';
import { ForbiddenError } from '../lib/errors.js';
import { getContext, type RequestContext } from '../lib/request-context.js';

/**
 * Clinic-scope enforcement + audit logging, implemented as a Prisma Client Extension
 * (`$use` middleware was removed in Prisma 6.19). The pure helpers below are exported
 * so the security logic can be unit-tested without a live database.
 */

const WRITE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
]);

const WHERE_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
]);

type AnyArgs = Record<string, unknown>;

/**
 * Returns args with clinicId injected for a clinic-scoped model, or throws when no
 * clinicId is available in a non-system context. Non-scoped models pass through.
 */
export function enforceClinicScope(
  model: string | undefined,
  operation: string,
  args: unknown,
  ctx: RequestContext | undefined,
): unknown {
  if (!isClinicScopedModel(model)) return args;
  if (ctx?.system) return args;

  if (!ctx?.clinicId) {
    throw new ForbiddenError(
      `clinicId is required for ${operation} on clinic-scoped model "${model}". ` +
        `Run inside a request context with a clinicId, or use runAsSystem() for admin operations.`,
    );
  }

  const clinicId = ctx.clinicId;
  const next: AnyArgs = { ...((args as AnyArgs | undefined) ?? {}) };

  if (WHERE_OPS.has(operation)) {
    next.where = { ...(next.where as AnyArgs | undefined), clinicId };
    if (operation === 'upsert') {
      next.create = { ...(next.create as AnyArgs | undefined), clinicId };
    }
  }

  if (operation === 'create') {
    next.data = { ...(next.data as AnyArgs | undefined), clinicId };
  }

  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const data = next.data;
    if (Array.isArray(data)) {
      next.data = data.map((row: AnyArgs) => ({ ...row, clinicId }));
    } else if (data) {
      next.data = { ...(data as AnyArgs), clinicId };
    }
  }

  return next;
}

/**
 * Builds the AuditLog row for a mutation, or null when no audit should be written
 * (reads, or mutations on AuditLog itself to avoid recursion).
 */
export function buildAuditData(
  model: string | undefined,
  operation: string,
  result: unknown,
  ctx: RequestContext | undefined,
): Prisma.AuditLogUncheckedCreateInput | null {
  if (!model || model === 'AuditLog' || !WRITE_OPS.has(operation)) return null;

  const entityId =
    result && typeof result === 'object' && 'id' in result
      ? String((result as { id: unknown }).id)
      : null;

  return {
    clinicId: ctx?.clinicId ?? null,
    userId: ctx?.userId ?? null,
    action: operation.toUpperCase(),
    entityType: model,
    entityId,
    metadata: ctx?.system ? { system: true } : {},
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
  };
}

export function createPrismaClient(logLevel: Prisma.LogLevel[] = ['warn', 'error']) {
  const base = new PrismaClient({ log: logLevel });

  return base.$extends({
    name: 'clinic-scope-and-audit',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = getContext();
          const scopedArgs = enforceClinicScope(model, operation, args, ctx);
          const result = await query(scopedArgs as typeof args);

          const auditData = buildAuditData(model, operation, result, ctx);
          if (auditData) {
            // Write via the un-extended base client so the audit write itself is not
            // re-scoped or re-audited (no recursion).
            try {
              await base.auditLog.create({ data: auditData });
            } catch (err) {
              // Audit must never break the primary mutation.
              console.error('Failed to write audit log:', err);
            }
          }

          return result;
        },
      },
    },
  });
}

export type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>;

export const prismaPlugin = fp(
  async (fastify) => {
    const prisma = createPrismaClient(
      fastify.log.level === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    );

    await prisma.$connect();
    fastify.decorate('prisma', prisma);

    fastify.addHook('onClose', async () => {
      await prisma.$disconnect();
    });

    fastify.log.info('Prisma connected');
  },
  { name: 'prisma' },
);
