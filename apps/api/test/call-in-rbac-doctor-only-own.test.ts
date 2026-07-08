import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  joinDoctor,
} from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

/**
 * Phase 9.6 Issue 1 (the other half): opening call-in to receptionists must NOT loosen the
 * doctor-side rule — a doctor still only calls into their OWN queue.
 */
describe('call-in RBAC — doctor limited to own queue', () => {
  it('a doctor cannot call in a patient assigned to another doctor (403 + ACCESS_DENIED audit)', async () => {
    const doctorA = await createDoctorWithClinic(app);
    const doctorB = await joinDoctor(app, doctorA.joinCode);
    const patientId = await createPatient(app, doctorA.clinicId, doctorA.userId);
    const visit = await createVisit(app, doctorA.clinicId, {
      patientId,
      doctorId: doctorB.userId,
      status: 'WAITING',
    });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/call-in`,
      headers: authHeader(doctorA.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(403);

    const denied = await app.prisma.auditLog.findFirst({
      where: { action: 'ACCESS_DENIED', entityId: visit.id, clinicId: doctorA.clinicId },
    });
    expect(denied).toBeTruthy();
  });

  it('a doctor CAN claim an unassigned walk-in (null assignedDoctorId)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, {
      patientId,
      doctorId: doctor.userId,
      status: 'WAITING',
    });
    // Simulate an unassigned walk-in: only doctorId set, assignedDoctorId cleared. (Scoped model —
    // the update must be awaited inside runWithContext or the scope middleware rejects it.)
    await runWithContext({ clinicId: doctor.clinicId }, async () => {
      await app.prisma.visit.update({ where: { id: visit.id }, data: { assignedDoctorId: null } });
    });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/call-in`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.visit.assignedDoctorId).toBe(doctor.userId);
  });
});
