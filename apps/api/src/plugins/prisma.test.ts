import { describe, expect, it } from 'vitest';
import { buildAuditData, enforceClinicScope } from './prisma.js';
import type { RequestContext } from '../lib/request-context.js';

const clinicCtx: RequestContext = { clinicId: 'clinic_1', userId: 'u1', ip: '1.2.3.4' };

describe('enforceClinicScope', () => {
  it('throws when there is no context for a clinic-scoped model', () => {
    expect(() => enforceClinicScope('Patient', 'findMany', {}, undefined)).toThrow(/clinicId/);
  });

  it('throws when context has no clinicId', () => {
    expect(() => enforceClinicScope('Patient', 'findMany', {}, { ip: '127.0.0.1' })).toThrow(
      /clinicId/,
    );
  });

  it('injects clinicId into the where clause for reads', () => {
    const out = enforceClinicScope('Patient', 'findMany', { where: { age: 30 } }, clinicCtx) as {
      where: Record<string, unknown>;
    };
    expect(out.where).toEqual({ age: 30, clinicId: 'clinic_1' });
  });

  it('forces clinicId onto create data (overriding any provided value)', () => {
    const out = enforceClinicScope(
      'Patient',
      'create',
      { data: { name: 'X', clinicId: 'OTHER' } },
      clinicCtx,
    ) as { data: Record<string, unknown> };
    expect(out.data.clinicId).toBe('clinic_1');
  });

  it('scopes every row of a createMany', () => {
    const out = enforceClinicScope(
      'Room',
      'createMany',
      { data: [{ name: 'A' }, { name: 'B' }] },
      clinicCtx,
    ) as { data: Array<Record<string, unknown>> };
    expect(out.data.every((r) => r.clinicId === 'clinic_1')).toBe(true);
  });

  it('bypasses scoping in an explicit system context', () => {
    const out = enforceClinicScope('Patient', 'findMany', { where: { age: 1 } }, { system: true });
    expect(out).toEqual({ where: { age: 1 } });
  });

  it('ignores non-clinic-scoped models', () => {
    const args = { where: { phone: '9' } };
    expect(enforceClinicScope('User', 'findMany', args, undefined)).toBe(args);
  });
});

describe('buildAuditData', () => {
  it('builds an audit row for a mutation, attributed from context', () => {
    const data = buildAuditData('Patient', 'create', { id: 'pat_1' }, clinicCtx);
    expect(data).toMatchObject({
      clinicId: 'clinic_1',
      userId: 'u1',
      action: 'CREATE',
      entityType: 'Patient',
      entityId: 'pat_1',
      ip: '1.2.3.4',
    });
  });

  it('returns null for reads', () => {
    expect(buildAuditData('Patient', 'findMany', [], clinicCtx)).toBeNull();
  });

  it('never recurses on AuditLog mutations', () => {
    expect(buildAuditData('AuditLog', 'create', { id: 'a1' }, clinicCtx)).toBeNull();
  });

  it('marks system-context writes in metadata', () => {
    const data = buildAuditData('Room', 'create', { id: 'r1' }, { system: true });
    expect(data?.metadata).toEqual({ system: true });
  });
});
