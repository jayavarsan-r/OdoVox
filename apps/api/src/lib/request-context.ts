import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context carried via AsyncLocalStorage so the global Prisma middleware
 * can enforce clinic scoping and attribute audit entries without threading params
 * through every call site.
 */
export interface RequestContext {
  clinicId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  /** Explicit escape hatch for admin/system operations that legitimately span clinics. */
  system?: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/**
 * Set the context for the current async execution and everything chained off it.
 * Used by the Fastify onRequest hook so the whole request lifecycle shares context.
 */
export function enterContext(ctx: RequestContext): void {
  storage.enterWith(ctx);
}

/** Run a block as a trusted system/admin context (bypasses clinic-scope enforcement). */
export function runAsSystem<T>(fn: () => T): T {
  return storage.run({ system: true }, fn);
}

export function getContext(): RequestContext | undefined {
  return storage.getStore();
}
