import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  joinDoctor,
  joinReceptionist,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('queue RBAC matrix', () => {
  it('a doctor cannot call-in a visit assigned to another doctor (403 + audit)', async () => {
    const doctorA = await createDoctorWithClinic(app);
    const doctorB = await joinDoctor(app, doctorA.joinCode);
    const patientId = await createPatient(app, doctorA.clinicId, doctorA.userId);
    const visit = await createVisit(app, doctorA.clinicId, { patientId, doctorId: doctorB.userId, status: 'WAITING' });

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

  // Phase 9.6 Issue 1: the Phase 4 matrix (call-in = doctor-only) was wrong — calling patients
  // in is the receptionist's core job. See call-in-rbac-receptionist-allowed.test.ts.
  it('a receptionist CAN call-in a patient (200)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/call-in`,
      headers: authHeader(recp.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
  });

  it('a doctor cannot reassign a visit (receptionist-only) (403)', async () => {
    const doctorA = await createDoctorWithClinic(app);
    const doctorB = await joinDoctor(app, doctorA.joinCode);
    const patientId = await createPatient(app, doctorA.clinicId, doctorA.userId);
    const visit = await createVisit(app, doctorA.clinicId, { patientId, doctorId: doctorA.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/reassign`,
      headers: authHeader(doctorA.accessToken),
      payload: { doctorId: doctorB.userId },
    });
    expect(res.statusCode).toBe(403);
  });

  it('a doctor cannot reach a visit in another clinic (404, no cross-clinic leak)', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const clinicB = await createDoctorWithClinic(app);
    const patientB = await createPatient(app, clinicB.clinicId, clinicB.userId);
    const visitB = await createVisit(app, clinicB.clinicId, { patientId: patientB, doctorId: clinicB.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visitB.id}/call-in`,
      headers: authHeader(clinicA.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(404);
  });

  it('a receptionist cannot create a walk-in in another clinic’s patient (404)', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const recpA = await joinReceptionist(app, clinicA.joinCode);
    const clinicB = await createDoctorWithClinic(app);
    const patientB = await createPatient(app, clinicB.clinicId, clinicB.userId);

    const res = await app.inject({
      method: 'POST',
      url: '/visits',
      headers: authHeader(recpA.accessToken),
      payload: { patientId: patientB, doctorId: clinicA.userId },
    });
    expect(res.statusCode).toBe(404);
  });
});
