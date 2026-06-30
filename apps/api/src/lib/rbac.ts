import type { FastifyRequest } from 'fastify';
import { ForbiddenError } from './errors.js';

export type Role = 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN';

/**
 * preHandler factory: require the caller's role to be one of `roles`. Must run *after*
 * `fastify.authenticate` (which populates `req.role` from the access token). A mismatch is
 * audit-logged and rejected with 403.
 */
export function requireRole(...roles: Role[]) {
  return async function roleGuard(req: FastifyRequest): Promise<void> {
    const role = req.role;
    if (!role || !roles.includes(role)) {
      await req.server.audit('ACCESS_DENIED', 'Route', null, {
        route: req.url,
        method: req.method,
        role: role ?? null,
        required: roles,
      });
      throw new ForbiddenError(`This action requires role: ${roles.join(' or ')}`);
    }
  };
}

/**
 * preHandler: require the caller to be a clinic admin. "Admin" in Odovox is the `isAdmin` flag on a
 * ClinicMember (typically the founding DOCTOR), not a distinct MemberRole — so we read the member
 * row for the request's clinic. Must run after `fastify.authenticate`.
 */
async function isClinicAdmin(req: FastifyRequest): Promise<boolean> {
  const userId = req.user?.id;
  const clinicId = req.clinicId;
  if (!userId || !clinicId) return false;
  const member = await req.server.prisma.clinicMember.findFirst({
    where: { userId, clinicId, deletedAt: null },
    select: { isAdmin: true },
  });
  return !!member?.isAdmin;
}

export function requireAdmin() {
  return async function adminGuard(req: FastifyRequest): Promise<void> {
    if (!(await isClinicAdmin(req))) {
      await req.server.audit('ACCESS_DENIED', 'Route', null, {
        route: req.url,
        method: req.method,
        required: 'isAdmin',
      });
      throw new ForbiddenError('This action requires a clinic admin');
    }
  };
}

/**
 * preHandler: allow a RECEPTIONIST or a clinic admin (the `isAdmin` flag — typically the founding
 * DOCTOR). Used by money actions a plain doctor must NOT do (record payment, cancel bill, reports),
 * where "admin" means the isAdmin flag rather than a distinct MemberRole. See the Phase 8 RBAC matrix.
 */
export function requireReceptionistOrAdmin() {
  return async function guard(req: FastifyRequest): Promise<void> {
    if (req.role === 'RECEPTIONIST' || (await isClinicAdmin(req))) return;
    await req.server.audit('ACCESS_DENIED', 'Route', null, {
      route: req.url,
      method: req.method,
      role: req.role ?? null,
      required: 'RECEPTIONIST or isAdmin',
    });
    throw new ForbiddenError('This action requires a receptionist or clinic admin');
  };
}
