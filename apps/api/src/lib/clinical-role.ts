import type { MemberRole } from '@odovox/types';

/**
 * Who may receive clinical PHI — medical flags, allergies, history, sitting notes.
 *
 * Owner rulings B1 and B4: a receptionist works the same patient record for billing,
 * scheduling and contact, but the clinical half of it must not reach their client. This is
 * the single predicate for that boundary, so the answer cannot drift between routes.
 *
 * Deliberately a function of role alone. It is tempting to widen it later ("just for this
 * one screen"), and a named predicate makes that a visible edit rather than an inline
 * condition nobody reviews.
 */
export function isClinicalRole(role: MemberRole | undefined | null): boolean {
  return role === 'DOCTOR' || role === 'ADMIN';
}
